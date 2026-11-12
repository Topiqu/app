import type { H3Event } from 'h3'

import argon from 'argon2'
import { DbNull } from '@zenstackhq/orm'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const ACCOUNT_DELETION_GRACE_DAYS = 30
export const ACCOUNT_DELETION_REMINDER_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000
const CONFIRM_TTL_MS = 60 * 60 * 1000

type ConfirmClaims = { purpose: 'confirm'; userId: string; siteIds: string[]; exp: number }
type RestoreClaims = { purpose: 'restore'; userId: string; requestedAt: number; exp: number }
type DeletionClaims = ConfirmClaims | RestoreClaims

const tokenSignature = (payload: string) => {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return createHmac('sha256', secret).update(`account-deletion:${payload}`).digest('base64url')
}

const signDeletionToken = (claims: DeletionClaims) => {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${tokenSignature(payload)}`
}

/** `purpose` keeps a restore link from confirming a deletion, and the reverse. */
const readDeletionToken = <P extends DeletionClaims['purpose']>(token: string, purpose: P) => {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const given = Buffer.from(signature)
  const expected = Buffer.from(tokenSignature(payload))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as DeletionClaims
  if (claims.purpose !== purpose || claims.exp < Date.now()) return null
  return claims as Extract<DeletionClaims, { purpose: P }>
}

export const signDeletionConfirmToken = (userId: string, siteIds: string[]) =>
  signDeletionToken({ purpose: 'confirm', userId, siteIds, exp: Date.now() + CONFIRM_TTL_MS })

/** Bound to this request's time, so the link dies once the account is restored or deleted again. */
export const signDeletionRestoreToken = (userId: string, requestedAt: Date, scheduledFor: Date) =>
  signDeletionToken({
    purpose: 'restore',
    userId,
    requestedAt: requestedAt.getTime(),
    exp: scheduledFor.getTime(),
  })

export const readDeletionConfirmToken = (token: string) => readDeletionToken(token, 'confirm')
export const readDeletionRestoreToken = (token: string) => readDeletionToken(token, 'restore')

const deletionUrl = (language: Language, action: 'confirm' | 'restore', token: string) =>
  `${useRuntimeConfig().public.baseUrl}/${language}/account-deletion?action=${action}&token=${encodeURIComponent(token)}`

const formatDate = (date: Date, language: Language) =>
  date.toLocaleDateString(languageTag(language), { dateStyle: 'long', timeZone: 'Europe/Prague' })

const BILLING_SELECT = {
  id: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  languageSubscriptionId: true,
  closingSubscriptionIds: true,
} as const

const BLOG_SELECT = {
  ...BILLING_SELECT,
  name: true,
  domain: true,
  logoUrl: true,
  plan: true,
  paidTeamSeats: true,
  deletedAt: true,
  shopifyConnection: { select: { planHandle: true } },
  tenantMemberships: {
    where: { deletedAt: null },
    select: { userId: true, role: true, user: { select: { deletedAt: true } } },
  },
} as const

/**
 * Blogs that close with this account. A blog with another active owner stays open. Blogs the owner already
 * deactivated are included because deactivation leaves their subscriptions running.
 */
export const closingBlogs = async (userId: string) => {
  const blogs = await prisma.clientSite.findMany({
    where: { tenantMemberships: { some: { userId, role: 'OWNER', deletedAt: null } } },
    select: BLOG_SELECT,
    orderBy: { createdAt: 'asc' },
  })
  return blogs.filter(
    ({ tenantMemberships }) =>
      !tenantMemberships.some(
        (member) => member.role === 'OWNER' && member.userId !== userId && !member.user.deletedAt,
      ),
  )
}

type ClosingBlog = Awaited<ReturnType<typeof closingBlogs>>[number]
type BillingBlog = Pick<
  ClosingBlog,
  'id' | 'stripeCustomerId' | 'stripeSubscriptionId' | 'languageSubscriptionId' | 'closingSubscriptionIds'
>

/** Null seats mark an individually contracted plan, whose terms this flow must not end on its own. */
const isContracted = (blog: Pick<ClosingBlog, 'plan' | 'paidTeamSeats'>) =>
  blog.plan === 'CUSTOM' && blog.paidTeamSeats === null

export const deletionPreview = async (userId: string) => {
  const [user, blogs] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, password: true, totpSecret: true },
    }),
    closingBlogs(userId),
  ])
  return {
    email: user.email,
    hasPassword: !!user.password,
    totpEnabled: !!user.totpSecret,
    graceDays: ACCOUNT_DELETION_GRACE_DAYS,
    contracted: blogs.some(isContracted),
    blogs: blogs
      .filter((blog) => !blog.deletedAt)
      .map((blog) => ({
        id: blog.id,
        name: blog.name,
        domain: blog.domain,
        paid: !!blog.stripeSubscriptionId,
        shopifyBilled: !!blog.shopifyConnection?.planHandle,
        otherMembers: blog.tenantMemberships.filter((member) => member.userId !== userId).length,
      })),
  }
}

const liveBlogs = (blogs: ClosingBlog[]) => blogs.filter((blog) => !blog.deletedAt)

export const liveBlogIds = (blogs: ClosingBlog[]) => liveBlogs(blogs).map((blog) => blog.id)

/** Includes already deactivated blogs: their contract is still running. */
export const hasContractedBlog = (blogs: ClosingBlog[]) => blogs.some(isContracted)

export const blogConfirmationsMatch = (blogs: ClosingBlog[], confirmations: Record<string, string>) =>
  liveBlogs(blogs).every((blog) => confirmations[blog.id] === blog.domain)

/** A blog created after the dialog was never typed out, so this request must not close it. */
export const sameLiveBlogs = (blogs: ClosingBlog[], siteIds: string[]) => {
  const current = liveBlogIds(blogs)
  return current.length === siteIds.length && current.every((id) => siteIds.includes(id))
}

const isMissingSubscription = (error: unknown) =>
  !!error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing'

const hasEnded = (status: string) => status === 'canceled' || status === 'incomplete_expired'

const BILLING_REQUEST = { timeout: 8000, maxNetworkRetries: 0 } as const

const lockClosingBilling = async (tx: DatabaseTransaction, id: string) => {
  const [blog] = await tx.$queryRaw<{ closingAt: Date | null; closingSubscriptionIds: string[] }[]>`
    SELECT "closingAt", "closingSubscriptionIds" FROM "ClientSite" WHERE "id" = ${id} FOR UPDATE`
  return blog
}

/** Reads Stripe rather than the row: a teammate may have subscribed again after the row was last synced. */
const blogSubscriptions = async (blog: BillingBlog) => {
  if (!blog.stripeCustomerId) return []
  const { data } = await useStripe().subscriptions.list({
    customer: blog.stripeCustomerId,
    status: 'all',
    limit: 100,
  })
  return data.filter(
    (subscription) =>
      !hasEnded(subscription.status) &&
      (subscription.metadata?.clientSiteId === blog.id ||
        subscription.id === blog.stripeSubscriptionId ||
        subscription.id === blog.languageSubscriptionId),
  )
}

/** A pending plan change cannot be restored once released, so the customer resolves it before deleting. */
export const hasScheduledBillingChange = async (blogs: BillingBlog[]) => {
  for (const blog of blogs) {
    if ((await blogSubscriptions(blog)).some((subscription) => subscription.schedule)) return true
  }
  return false
}

/**
 * The id is recorded before Stripe changes, so a crash cannot leave a subscription ended with no way to resume it.
 * One the customer already cancelled is skipped, so a restore does not revive it.
 */
export const endBlogBilling = async (blog: BillingBlog) => {
  const stripe = useStripe()
  for (const subscription of await blogSubscriptions(blog)) {
    if (subscription.cancel_at_period_end) continue
    // Commit the recovery marker before Stripe: a failed transaction cannot erase evidence of a remote change.
    await prisma.clientSite.updateMany({
      where: { id: blog.id, closingAt: { not: null }, NOT: { closingSubscriptionIds: { has: subscription.id } } },
      data: { closingSubscriptionIds: { push: [subscription.id] } },
    })
    await prisma.$transaction(async (tx) => {
      const current = await lockClosingBilling(tx, blog.id)
      if (!current?.closingAt || !current.closingSubscriptionIds.includes(subscription.id)) return
      // Bounded provider requests under the row lock; restoration waits until they finish.
      if (subscription.schedule) {
        const scheduleId = typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule.id
        await stripe.subscriptionSchedules.release(scheduleId, {}, BILLING_REQUEST)
      }
      await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true }, BILLING_REQUEST)
    })
  }
}

type BillingState = 'resumed' | 'ended' | 'failed'

/** Ids stay recorded until Stripe confirms, so the hourly task can retry after an outage. */
const resumeBlogBilling = async (blog: Pick<BillingBlog, 'id'>): Promise<BillingState> => {
  const stripe = useStripe()
  const snapshot = await prisma.clientSite.findUnique({
    where: { id: blog.id },
    select: { closingSubscriptionIds: true },
  })
  let state: BillingState = 'resumed'
  for (const subscriptionId of new Set(snapshot?.closingSubscriptionIds ?? [])) {
    try {
      const outcome = await prisma.$transaction(async (tx): Promise<BillingState> => {
        const current = await lockClosingBilling(tx, blog.id)
        if (!current) return 'ended'
        if (current.closingAt) return 'failed'
        if (!current.closingSubscriptionIds.includes(subscriptionId)) return 'resumed'
        let ended: boolean
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId, {}, BILLING_REQUEST)
          ended = hasEnded(subscription.status)
          if (!ended)
            await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false }, BILLING_REQUEST)
        } catch (error) {
          if (!isMissingSubscription(error)) throw error
          ended = true
        }
        await tx.clientSite.update({
          where: { id: blog.id },
          data: { closingSubscriptionIds: current.closingSubscriptionIds.filter((id) => id !== subscriptionId) },
        })
        return ended ? 'ended' : 'resumed'
      })
      if (outcome === 'failed' || state === 'resumed') state = outcome
    } catch (error) {
      state = 'failed'
      await reportCaughtError('Account deletion subscription resume failed', error, {
        clientSiteId: blog.id,
        subscriptionId,
      })
    }
  }
  return state
}

/** Retries what a request could not finish, and catches a subscription that started while a blog was closing. */
export const settleClosingBilling = async () => {
  const closing = await prisma.clientSite.findMany({
    where: { closingAt: { not: null }, stripeCustomerId: { not: null } },
    select: BILLING_SELECT,
    take: 200,
  })
  for (const blog of closing) {
    try {
      await endBlogBilling(blog)
    } catch (error) {
      await reportCaughtError('Closing blog billing failed', error, { clientSiteId: blog.id })
    }
  }
  const restored = await prisma.clientSite.findMany({
    where: { closingAt: null, closingSubscriptionIds: { isEmpty: false } },
    select: { id: true, closingSubscriptionIds: true },
    take: 200,
  })
  for (const blog of restored) await resumeBlogBilling(blog)
}

/** Billing is frozen while a blog closes: nobody could cancel a new subscription once the blog is gone. */
export const assertBlogNotClosing = async (clientSiteId: string, message: string) => {
  const site = await prisma.clientSite.findUnique({ where: { id: clientSiteId }, select: { closingAt: true } })
  if (site?.closingAt) throw createError({ statusCode: 409, message })
}

const sendQuietly = async (description: string, context: Record<string, unknown>, send: () => Promise<unknown>) => {
  try {
    await send()
  } catch (error) {
    await reportCaughtError(description, error, context)
  }
}

const sendScheduledEmail = (
  user: { id: string; email: string; username: string; language: Language },
  requestedAt: Date,
  scheduledFor: Date,
  event?: H3Event,
) =>
  sendQuietly('Account deletion email failed', { userId: user.id }, () =>
    sendEmail({
      event,
      to: user.email,
      lang: user.language,
      template: 'accountDeletionScheduled',
      abortSignal: AbortSignal.timeout(20_000),
      data: {
        userName: user.username,
        deletionDate: formatDate(scheduledFor, user.language),
        actionUrl: deletionUrl(user.language, 'restore', signDeletionRestoreToken(user.id, requestedAt, scheduledFor)),
      },
    }),
  )

const notifyMembers = async (
  template: 'accountDeletionBlogClosing' | 'accountDeletionBlogKept',
  blogs: ClosingBlog[],
  ownerId: string,
  closingAt?: Date,
  event?: H3Event,
) => {
  for (const blog of liveBlogs(blogs)) {
    const memberIds = blog.tenantMemberships.map((member) => member.userId).filter((id) => id !== ownerId)
    if (!memberIds.length) continue
    const members = await prisma.user.findMany({
      where: { id: { in: memberIds }, deletedAt: null },
      select: { id: true, email: true, username: true, language: true },
    })
    for (const member of members) {
      await sendQuietly('Account deletion member notice failed', { clientSiteId: blog.id, userId: member.id }, () =>
        sendEmail({
          event,
          to: member.email,
          lang: member.language,
          template,
          abortSignal: AbortSignal.timeout(20_000),
          data: {
            userName: member.username,
            tenantName: blog.name,
            tenantLogoUrl: blog.logoUrl ?? '',
            ...(closingAt ? { deletionDate: formatDate(closingAt, member.language) } : {}),
          },
        }),
      )
    }
  }
}

export const sendDeletionConfirmEmail = (
  user: { id: string; email: string; username: string; language: Language },
  siteIds: string[],
  event: H3Event,
) =>
  sendEmail({
    event,
    to: user.email,
    lang: user.language,
    template: 'accountDeletionConfirm',
    abortSignal: AbortSignal.timeout(20_000),
    data: {
      userName: user.username,
      actionUrl: deletionUrl(user.language, 'confirm', signDeletionConfirmToken(user.id, siteIds)),
    },
  })

/**
 * The row lock is the claim: an overlapping request gets 409 before it touches Stripe. Billing follows the commit
 * and is not undone on failure, because the hourly task keeps retrying it.
 */
export const scheduleAccountDeletion = async (userId: string, confirmedSiteIds: string[], event: H3Event) => {
  const blogs = await closingBlogs(userId)
  if (!sameLiveBlogs(blogs, confirmedSiteIds))
    throw createError({ statusCode: 409, message: 'Blogs changed since the request' })

  const now = new Date()
  const scheduledFor = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)

  const user = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
    const current = await tx.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, username: true, language: true },
    })
    if (!current) throw createError({ statusCode: 409, message: 'Account is not active' })
    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        deletionRequestedAt: now,
        deletionScheduledFor: scheduledFor,
        deletionReminderSentAt: null,
      },
    })
    await tx.session.deleteMany({ where: { userId } })
    await tx.clientSite.updateMany({
      where: { id: { in: blogs.map((blog) => blog.id) } },
      data: { closingAt: scheduledFor },
    })
    await logAction({
      tx,
      action: 'ACCOUNT_DELETION_REQUESTED',
      userId,
      ip: getIp(event),
      metadata: { closingBlogs: blogs.map((blog) => blog.id), scheduledFor: scheduledFor.toISOString() },
    })
    return current
  })

  await invalidateAuthor(userId)
  for (const blog of blogs) {
    await endBlogBilling(blog).catch((error) =>
      reportCaughtError('Closing blog billing failed', error, { clientSiteId: blog.id }),
    )
  }
  await sendScheduledEmail(user, now, scheduledFor, event)
  await notifyMembers('accountDeletionBlogClosing', blogs, userId, scheduledFor, event)
  return { scheduledFor }
}

/** The link in the mailbox is the proof, so restoring works signed out and cannot be done with a password alone. */
export const restoreAccount = async (claims: RestoreClaims, event: H3Event) => {
  const { userId } = claims
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
    const user = await tx.user.findFirst({
      where: {
        id: userId,
        anonymizedAt: null,
        deletionRequestedAt: new Date(claims.requestedAt),
        deletionScheduledFor: { gt: new Date() },
      },
      select: { id: true, email: true, username: true, language: true },
    })
    if (!user) return null
    const blogs = await tx.clientSite.findMany({
      where: { closingAt: { not: null }, tenantMemberships: { some: { userId, role: 'OWNER', deletedAt: null } } },
      select: { id: true, closingSubscriptionIds: true },
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        deletedAt: null,
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionReminderSentAt: null,
      },
    })
    await tx.clientSite.updateMany({ where: { id: { in: blogs.map((blog) => blog.id) } }, data: { closingAt: null } })
    await logAction({
      tx,
      action: 'ACCOUNT_DELETION_CANCELLED',
      userId,
      ip: getIp(event),
      metadata: { blogs: blogs.map((blog) => blog.id) },
    })
    return { user, blogs }
  })
  if (!result) return false

  let billing: BillingState = 'resumed'
  for (const blog of result.blogs) {
    const state = await resumeBlogBilling(blog)
    if (state === 'failed' || billing === 'resumed') billing = state
  }
  await invalidateAuthor(userId)
  await sendQuietly('Account restore email failed', { userId }, () =>
    sendEmail({
      event,
      to: result.user.email,
      lang: result.user.language,
      template: 'accountDeletionRestored',
      abortSignal: AbortSignal.timeout(20_000),
      data: { userName: result.user.username },
    }),
  )
  await notifyMembers('accountDeletionBlogKept', await closingBlogs(userId), userId, undefined, event)
  return { billing }
}

/** Resends the restore link after a sign-in attempt. The mailbox stays the proof; a password alone never restores. */
export const offerAccountRestore = async (userId: string) => {
  if (!(await consumeRateLimit(`account-restore-offer:${userId}`, 3, 3600))) return
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      anonymizedAt: null,
      deletionRequestedAt: { not: null },
      deletionScheduledFor: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      username: true,
      language: true,
      deletionRequestedAt: true,
      deletionScheduledFor: true,
    },
  })
  if (user?.deletionRequestedAt && user.deletionScheduledFor)
    await sendScheduledEmail(user, user.deletionRequestedAt, user.deletionScheduledFor)
}

/**
 * True when this password belongs to an account waiting for deletion, which gets a restore link instead of a session.
 * Two-factor is not asked for here because the link only reaches the owner's mailbox, and no session opens.
 */
export const pendingDeletionSignIn = async (email: string, password: string) => {
  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      anonymizedAt: null,
      deletionRequestedAt: { not: null },
    },
    select: { id: true, password: true },
  })
  if (!user?.password || !(await argon.verify(user.password, password))) return false
  await offerAccountRestore(user.id)
  return true
}

/** A public author ID must not let another account reserve its anonymized username or email. */
export const anonymizedIdentity = () => {
  const id = randomUUID().replace(/-/g, '')
  return { username: `deleted-${id}`, email: `deleted-${id}@deleted.invalid` }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The row stays and only its personal fields go: `Article` cascades from `User`, which would delete articles on
 * other people's blogs, `Log` rows form an HMAC chain, and `OnboardingRequest` restricts deletion.
 */
export const anonymizeAccount = async (userId: string, now = new Date()) => {
  const due = await prisma.user.findFirst({
    where: { id: userId, anonymizedAt: null, deletionScheduledFor: { lte: now } },
    select: { id: true },
  })
  if (!due) return false

  // Before anything irreversible, and throwing keeps the account due: once the blog is gone nobody can cancel.
  const billing = await prisma.clientSite.findMany({
    where: { closingAt: { not: null }, tenantMemberships: { some: { userId, role: 'OWNER', deletedAt: null } } },
    select: BILLING_SELECT,
  })
  for (const blog of billing) await endBlogBilling(blog)

  const identity = anonymizedIdentity()
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
    const user = await tx.user.findFirst({
      where: { id: userId, anonymizedAt: null, deletionScheduledFor: { lte: now } },
      select: { email: true, username: true, avatarUrl: true },
    })
    if (!user) return null

    const blogs = await tx.clientSite.findMany({
      where: { closingAt: { not: null }, tenantMemberships: { some: { userId, role: 'OWNER', deletedAt: null } } },
      select: { id: true, domain: true, deletedAt: true },
    })
    const blogIds = blogs.map((blog) => blog.id)
    const closedBlogs = blogs.filter((blog) => !blog.deletedAt)
    await tx.clientSite.updateMany({
      where: { id: { in: closedBlogs.map((blog) => blog.id) } },
      data: { deletedAt: now },
    })
    await tx.clientSite.updateMany({
      where: { id: { in: blogIds } },
      data: { closingAt: null, closingSubscriptionIds: [] },
    })
    // Same detachment as an owner deactivating a blog, plus the provider connections nobody can use any more.
    await tx.session.updateMany({ where: { clientSiteId: { in: blogIds } }, data: { clientSiteId: null } })
    const companies = await tx.linkedinCompany.findMany({
      where: { clientSiteId: { in: blogIds } },
      select: { id: true },
    })
    for (const { id } of companies) {
      // The identifier is personal for a profile and unique, so keeping it would also block reconnecting it elsewhere.
      await tx.linkedinCompany.update({
        where: { id },
        data: {
          name: 'deleted',
          linkedinOrgId: `deleted:${id}`,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        },
      })
    }
    await tx.searchConsoleConnection.deleteMany({ where: { clientSiteId: { in: blogIds } } })
    const shops = await tx.shopifyConnection.findMany({
      where: { clientSiteId: { in: blogIds } },
      select: { id: true },
    })
    await tx.shopifyConnection.updateMany({
      where: { id: { in: shops.map((shop) => shop.id) } },
      data: {
        status: 'REVOKED',
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        refreshLease: null,
        refreshLeaseUntil: null,
      },
    })
    await tx.shopifyPublication.updateMany({
      where: { connectionId: { in: shops.map((shop) => shop.id) }, status: { in: ['QUEUED', 'PUBLISHING'] } },
      data: { status: 'FAILED', lease: null, leaseUntil: null, lastError: 'Blog closed' },
    })

    await tx.session.deleteMany({ where: { userId } })
    await tx.account.deleteMany({ where: { userId } })
    await tx.verificationCode.deleteMany({ where: { userId } })
    await tx.apiKey.updateMany({ where: { createdById: userId }, data: { revokedAt: now, createdById: null } })
    await tx.tenantInvitation.updateMany({
      where: { invitedById: userId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    })
    await tx.tenantInvitation.deleteMany({ where: { email: { equals: user.email, mode: 'insensitive' } } })
    await tx.tenantMembership.deleteMany({ where: { userId } })
    await tx.articleDraft.deleteMany({ where: { userId } })
    await tx.notification.deleteMany({ where: { userId } })
    await tx.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followedId: userId }] } })
    await tx.commentReaction.deleteMany({ where: { userId } })
    await tx.emojiReaction.deleteMany({ where: { userId } })
    await tx.articleReaction.deleteMany({ where: { userId } })
    await tx.articleFeedback.deleteMany({ where: { userId } })
    await tx.articleShare.updateMany({ where: { userId }, data: { userId: null } })
    await tx.articleView.updateMany({ where: { userId }, data: { userId: null } })
    await tx.pollResult.updateMany({ where: { userId }, data: { userId: null } })
    await tx.userBan.deleteMany({ where: { userId } })
    await tx.approval.updateMany({ where: { reviewerId: userId }, data: { notes: null } })
    // A blog's dashboard counts these rows as generation receipts, so only what the person wrote goes.
    await tx.articleGenerationSession.updateMany({
      where: { userId },
      data: { prompt: '', options: {}, recoverableSnapshot: DbNull, checkpoints: [], failureReason: null },
    })
    await tx.articleRevision.updateMany({ where: { actorId: userId }, data: { actorName: null } })
    // Replies hang off these rows, so the text goes and the row stays.
    await tx.comment.updateMany({ where: { userId }, data: { content: '[deleted]', gifUrl: null, sentiment: DbNull } })
    await tx.comment.updateMany({ where: { userId, deletedAt: null }, data: { deletedAt: now } })

    // OAuth usernames default to the real name, and other people's rows hold it as plain text: every reply starts
    // with "@username", and notifications spell it out. Whole-word matches keep "ann" from touching "annual".
    const name = `(?<![[:alnum:]_])${escapeRegex(user.username)}(?![[:alnum:]_])`
    const mention = `@${name}`
    const replacement = `@${identity.username}`
    await tx.$executeRaw`UPDATE "public"."Comment" SET "content" = regexp_replace("content", ${mention}, ${replacement}, 'g') WHERE "content" ~ ${mention}`
    await tx.$executeRaw`UPDATE "public"."Notification" SET "message" = regexp_replace("message", ${name}, ${identity.username}, 'g') WHERE "message" ~ ${name}`

    await tx.user.update({
      where: { id: userId },
      data: {
        ...identity,
        password: null,
        bio: null,
        avatarUrl: null,
        totpSecret: null,
        totpTempSecret: null,
        onboardingLoginToken: null,
        onboardingLoginTokenExpiresAt: null,
        emailVerified: false,
        allowNotifs: false,
        allowEmail: false,
        role: 'reader',
        clientSiteId: null,
        deletedAt: now,
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionReminderSentAt: null,
        anonymizedAt: now,
      },
    })
    await logAction({ tx, action: 'ACCOUNT_ANONYMIZED', userId, metadata: { closedBlogs: blogIds } })
    return { avatarUrl: user.avatarUrl, closedBlogs }
  })
  if (!result) return false

  await invalidateAuthor(userId)
  for (const blog of result.closedBlogs) {
    await invalidateFeed(blog.id)
    await uncache(tenantHostKey(blog.domain), domainRedirectKey(blog.domain))
  }
  const avatarKey = avatarKeyFromUrl(result.avatarUrl, useRuntimeConfig().public.cdnUrl)
  if (avatarKey)
    await deleteFromCdn(avatarKey, `avatars/${userId}/`).catch((error) =>
      reportCaughtError('Anonymised avatar cleanup failed', error, { userId }),
    )
  return true
}

export const sendDeletionReminder = async (user: {
  id: string
  email: string
  username: string
  language: Language
  deletionRequestedAt: Date
  deletionScheduledFor: Date
}) =>
  sendEmail({
    to: user.email,
    lang: user.language,
    template: 'accountDeletionReminder',
    abortSignal: AbortSignal.timeout(20_000),
    data: {
      userName: user.username,
      deletionDate: formatDate(user.deletionScheduledFor, user.language),
      actionUrl: deletionUrl(
        user.language,
        'restore',
        signDeletionRestoreToken(user.id, user.deletionRequestedAt, user.deletionScheduledFor),
      ),
    },
  })
