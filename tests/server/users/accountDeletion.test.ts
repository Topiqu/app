import { createError } from 'h3'
import { readFileSync } from 'node:fs'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const USER_ID = '11111111-2222-3333-4444-555555555555'
const argonVerify = vi.hoisted(() => vi.fn(async () => true))

vi.mock('argon2', () => ({ default: { verify: argonVerify } }))
mockNuxtImport('useRuntimeConfig', () => () => ({
  public: { baseUrl: 'https://app.example.test', cdnUrl: 'https://cdn.example.test' },
}))

type Member = { userId: string; role: string; user: { deletedAt: Date | null } }

type Blog = {
  id: string
  name: string
  domain: string
  logoUrl: string | null
  plan: string
  paidTeamSeats: number | null
  deletedAt: Date | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  languageSubscriptionId: string | null
  closingSubscriptionIds: string[]
  shopifyConnection: { planHandle: string | null } | null
  tenantMemberships: Member[]
}

const member = (userId: string, role = 'MEMBER', deletedAt: Date | null = null): Member => ({
  userId,
  role,
  user: { deletedAt },
})

const blog = (overrides: Partial<Blog> = {}): Blog => ({
  id: 'site-1',
  name: 'Blog',
  domain: 'blog.example.com',
  logoUrl: null,
  plan: 'PRO',
  paidTeamSeats: 1,
  deletedAt: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  languageSubscriptionId: null,
  closingSubscriptionIds: [],
  shopifyConnection: null,
  tenantMemberships: [member(USER_ID, 'OWNER')],
  ...overrides,
})

/** A Stripe client holding these subscriptions for every customer. */
const stubStripe = (subscriptions: Record<string, unknown>[] = []) => {
  const stripe = {
    subscriptions: {
      list: vi.fn(async () => ({ data: subscriptions })),
      retrieve: vi.fn(async (id: string) => subscriptions.find((subscription) => subscription.id === id) ?? {}),
      update: vi.fn(async (_id: string, _params: unknown): Promise<object> => ({})),
    },
    subscriptionSchedules: { release: vi.fn(async () => ({})) },
  }
  vi.stubGlobal('useStripe', () => stripe)
  return stripe
}

const activeSubscription = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  status: 'active',
  cancel_at_period_end: false,
  schedule: null,
  metadata: { clientSiteId: 'site-1' },
  ...overrides,
})

const importModule = () => import('../../../server/utils/accountDeletion')

const stubCommon = () => {
  vi.stubEnv('AUTH_SECRET', 'test-secret')
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('languageTag', () => 'en-GB')
  vi.stubGlobal('getIp', () => '192.0.2.1')
  vi.stubGlobal('invalidateAuthor', vi.fn())
  vi.stubGlobal('invalidateFeed', vi.fn())
  vi.stubGlobal('uncache', vi.fn())
  vi.stubGlobal('tenantHostKey', (host: string) => `host:${host}`)
  vi.stubGlobal('domainRedirectKey', (host: string) => `redirect:${host}`)
  vi.stubGlobal('avatarKeyFromUrl', () => null)
  vi.stubGlobal('deleteFromCdn', vi.fn())
  vi.stubGlobal('reportCaughtError', vi.fn())
  vi.stubGlobal(
    'consumeRateLimit',
    vi.fn(async () => true),
  )
  vi.stubGlobal('logAction', vi.fn())
  vi.stubGlobal(
    'sendEmail',
    vi.fn(async () => undefined),
  )
}

/** A transaction client whose every model method records its call. */
const fakeTx = (overrides: Record<string, unknown> = {}) => {
  const calls: { model: string; method: string; args: any }[] = []
  const tx: any = new Proxy(
    { $queryRaw: vi.fn(async () => []), $executeRaw: vi.fn(async () => 1), ...overrides },
    {
      get: (target: any, model: string) =>
        model in target
          ? target[model]
          : new Proxy(
              {},
              {
                get: (_, method: string) => async (args: unknown) => {
                  calls.push({ model, method, args })
                  return method === 'findMany' ? [] : { count: 1 }
                },
              },
            ),
    },
  )
  return { tx, calls }
}

beforeEach(() => {
  vi.resetModules()
  stubCommon()
  argonVerify.mockReset()
  argonVerify.mockResolvedValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('deletion links', () => {
  it('keeps a restore link from confirming a deletion, and the reverse', async () => {
    const { signDeletionConfirmToken, signDeletionRestoreToken, readDeletionConfirmToken, readDeletionRestoreToken } =
      await importModule()
    const confirm = signDeletionConfirmToken(USER_ID, ['site-1'])
    const restore = signDeletionRestoreToken(USER_ID, new Date(), new Date(Date.now() + 60_000))

    expect(readDeletionConfirmToken(confirm)).toMatchObject({ userId: USER_ID, siteIds: ['site-1'] })
    expect(readDeletionRestoreToken(restore)).toMatchObject({ userId: USER_ID })
    expect(readDeletionRestoreToken(confirm)).toBeNull()
    expect(readDeletionConfirmToken(restore)).toBeNull()
  })

  it('rejects a tampered token', async () => {
    const { signDeletionConfirmToken, readDeletionConfirmToken } = await importModule()
    const [payload, signature] = signDeletionConfirmToken(USER_ID, []).split('.')
    const forged = Buffer.from(
      JSON.stringify({ purpose: 'confirm', userId: 'victim', siteIds: [], exp: 9e15 }),
    ).toString('base64url')

    expect(readDeletionConfirmToken(`${forged}.${signature}`)).toBeNull()
    expect(readDeletionConfirmToken(`${payload}.`)).toBeNull()
    expect(readDeletionConfirmToken('nonsense')).toBeNull()
  })

  it('expires the confirmation link after an hour', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-05T10:00:00Z') })
    const { signDeletionConfirmToken, readDeletionConfirmToken } = await importModule()
    const token = signDeletionConfirmToken(USER_ID, [])

    vi.setSystemTime(new Date('2026-11-05T10:59:59Z'))
    expect(readDeletionConfirmToken(token)).not.toBeNull()
    vi.setSystemTime(new Date('2026-11-05T11:00:01Z'))
    expect(readDeletionConfirmToken(token)).toBeNull()
  })
})

describe('blog confirmation', () => {
  it('needs the exact domain of every live blog, but not of an already deactivated one', async () => {
    const { blogConfirmationsMatch } = await importModule()
    const blogs = [blog(), blog({ id: 'old', domain: 'old.example.com', deletedAt: new Date() })] as never

    expect(blogConfirmationsMatch(blogs, { 'site-1': 'blog.example.com' })).toBe(true)
    expect(blogConfirmationsMatch(blogs, { 'site-1': 'BLOG.example.com' })).toBe(false)
    expect(blogConfirmationsMatch(blogs, {})).toBe(false)
  })

  it('refuses a confirmation when a new blog appeared after the dialog', async () => {
    const { sameLiveBlogs } = await importModule()
    const blogs = [blog(), blog({ id: 'new' })] as never

    expect(sameLiveBlogs(blogs, ['site-1', 'new'])).toBe(true)
    expect(sameLiveBlogs(blogs, ['site-1'])).toBe(false)
  })

  it('stops only for an individual contract, including on a deactivated blog', async () => {
    const { hasContractedBlog } = await importModule()

    expect(hasContractedBlog([blog({ plan: 'CUSTOM', paidTeamSeats: null })] as never)).toBe(true)
    expect(hasContractedBlog([blog({ plan: 'CUSTOM', paidTeamSeats: null, deletedAt: new Date() })] as never)).toBe(
      true,
    )
    expect(hasContractedBlog([blog({ plan: 'CUSTOM', paidTeamSeats: 3 })] as never)).toBe(false)
    expect(hasContractedBlog([blog()] as never)).toBe(false)
  })

  it('leaves a blog with another active owner out of the closure, but not one whose owner is leaving too', async () => {
    const findMany = vi.fn(async () => [
      blog(),
      blog({ id: 'shared', tenantMemberships: [member(USER_ID, 'OWNER'), member('other', 'OWNER')] }),
      blog({
        id: 'both-leaving',
        tenantMemberships: [member(USER_ID, 'OWNER'), member('gone', 'OWNER', new Date())],
      }),
    ])
    vi.stubGlobal('prisma', { clientSite: { findMany } })
    const { closingBlogs } = await importModule()

    expect((await closingBlogs(USER_ID)).map(({ id }) => id)).toEqual(['site-1', 'both-leaving'])
  })
})

describe('blog billing', () => {
  const stubPrisma = () => {
    const update = vi.fn(async (_args: unknown) => ({}))
    vi.stubGlobal('prisma', { clientSite: { update } })
    return update
  }
  const billed = blog({ stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' })

  it('records the subscription before ending it, so a crash cannot lose it', async () => {
    const order: string[] = []
    const update = stubPrisma()
    update.mockImplementation(async () => {
      order.push('recorded')
      return {}
    })
    const stripe = stubStripe([activeSubscription('sub_1')])
    stripe.subscriptions.update.mockImplementation(async () => {
      order.push('ended')
      return {}
    })
    const { endBlogBilling } = await importModule()

    await endBlogBilling(billed)

    expect(order).toEqual(['recorded', 'ended'])
    expect(update).toHaveBeenCalledWith({ where: { id: 'site-1' }, data: { closingSubscriptionIds: ['sub_1'] } })
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true })
  })

  it('catches a subscription the row does not know about, such as one a teammate just started', async () => {
    stubPrisma()
    const stripe = stubStripe([activeSubscription('sub_new')])
    const { endBlogBilling } = await importModule()

    await endBlogBilling(billed)

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_new', { cancel_at_period_end: true })
  })

  it("leaves another blog's subscription on a shared customer alone", async () => {
    stubPrisma()
    const stripe = stubStripe([activeSubscription('sub_other', { metadata: { clientSiteId: 'site-2' } })])
    const { endBlogBilling } = await importModule()

    await endBlogBilling(billed)

    expect(stripe.subscriptions.update).not.toHaveBeenCalled()
  })

  it('does not take over a subscription the customer already cancelled', async () => {
    const update = stubPrisma()
    const stripe = stubStripe([activeSubscription('sub_1', { cancel_at_period_end: true })])
    const { endBlogBilling } = await importModule()

    await endBlogBilling(billed)

    expect(stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('ignores a subscription that already ended', async () => {
    stubPrisma()
    const stripe = stubStripe([activeSubscription('sub_1', { status: 'canceled' })])
    const { endBlogBilling, hasScheduledBillingChange } = await importModule()

    await endBlogBilling(billed)

    expect(stripe.subscriptions.update).not.toHaveBeenCalled()
    await expect(hasScheduledBillingChange([billed])).resolves.toBe(false)
  })

  it('reports a pending plan change, which must be resolved before deleting', async () => {
    stubStripe([activeSubscription('sub_1', { schedule: 'sched_1' })])
    const { hasScheduledBillingChange } = await importModule()

    await expect(hasScheduledBillingChange([billed])).resolves.toBe(true)
  })

  it('releases a schedule when a closing blog still has one, because Stripe refuses the cancellation otherwise', async () => {
    stubPrisma()
    const stripe = stubStripe([activeSubscription('sub_1', { schedule: 'sched_1' })])
    const { endBlogBilling } = await importModule()

    await endBlogBilling(billed)

    expect(stripe.subscriptionSchedules.release).toHaveBeenCalledWith('sched_1')
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true })
  })

  it('freezes billing on a closing blog', async () => {
    const findUnique = vi.fn(async () => ({ closingAt: new Date() }))
    vi.stubGlobal('prisma', { clientSite: { findUnique } })
    const { assertBlogNotClosing } = await importModule()

    await expect(assertBlogNotClosing('site-1', 'closing')).rejects.toMatchObject({ statusCode: 409 })
    findUnique.mockResolvedValueOnce({ closingAt: null } as never)
    await expect(assertBlogNotClosing('site-1', 'closing')).resolves.toBeUndefined()
  })

  it('retries both directions in the hourly sweep, and one failure does not stop the rest', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        blog({ id: 'broken', stripeCustomerId: 'cus_broken' }),
        blog({ stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' }),
      ])
      .mockResolvedValueOnce([{ id: 'restored', closingSubscriptionIds: ['sub_back'] }])
    const update = vi.fn(async () => ({}))
    vi.stubGlobal('prisma', { clientSite: { findMany, update } })
    const stripe = stubStripe([activeSubscription('sub_1'), activeSubscription('sub_back')])
    stripe.subscriptions.list.mockRejectedValueOnce(new Error('Stripe down'))
    const { settleClosingBilling } = await importModule()

    await settleClosingBilling()

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true })
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_back', { cancel_at_period_end: false })
    expect(reportCaughtError).toHaveBeenCalledTimes(1)
  })
})

describe('scheduleAccountDeletion', () => {
  const setup = (options: { blogs?: Blog[]; active?: boolean; txError?: Error } = {}) => {
    const account = { id: USER_ID, email: 'a@example.test', username: 'alice', language: 'en' }
    const { tx, calls } = fakeTx({
      user: {
        findFirst: vi.fn(async () => (options.active === false ? null : account)),
        update: vi.fn(async (args: unknown) => calls.push({ model: 'user', method: 'update', args })),
      },
    })
    vi.stubGlobal('prisma', {
      clientSite: {
        findMany: vi.fn(async () => options.blogs ?? []),
        update: vi.fn(async () => ({})),
      },
      user: { findMany: vi.fn(async () => [{ id: 'member', email: 'm@example.test', username: 'm', language: 'en' }]) },
      $transaction: vi.fn(async (run: (client: unknown) => unknown) => {
        if (options.txError) throw options.txError
        return run(tx)
      }),
    })
    return { calls }
  }
  const paid = () => blog({ stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' })

  it('deactivates the account, ends sessions and mails the restore link', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-05T10:00:00Z') })
    const { calls } = setup()
    stubStripe()
    const { scheduleAccountDeletion } = await importModule()

    const { scheduledFor } = await scheduleAccountDeletion(USER_ID, [], {} as never)

    expect(scheduledFor).toEqual(new Date('2026-12-05T10:00:00Z'))
    expect(calls.find(({ model, method }) => model === 'user' && method === 'update')?.args.data).toMatchObject({
      deletedAt: new Date('2026-11-05T10:00:00Z'),
      deletionScheduledFor: new Date('2026-12-05T10:00:00Z'),
    })
    expect(calls).toContainEqual({ model: 'session', method: 'deleteMany', args: { where: { userId: USER_ID } } })
    const mail = vi.mocked(sendEmail).mock.calls.at(-1)![0]
    expect(mail).toMatchObject({ template: 'accountDeletionScheduled', to: 'a@example.test' })
    expect(mail.data.actionUrl).toContain('/en/account-deletion?action=restore&token=')
  })

  it('marks blogs as closing and ends their billing only after the commit', async () => {
    const { calls } = setup({ blogs: [paid()] })
    const stripe = stubStripe([activeSubscription('sub_1')])
    const { scheduleAccountDeletion } = await importModule()

    await scheduleAccountDeletion(USER_ID, ['site-1'], {} as never)

    expect(calls).toContainEqual({
      model: 'clientSite',
      method: 'updateMany',
      args: { where: { id: { in: ['site-1'] } }, data: { closingAt: expect.any(Date) } },
    })
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: true })
  })

  it('never touches Stripe when an overlapping request already claimed the account', async () => {
    setup({ blogs: [paid()], active: false })
    const stripe = stubStripe([activeSubscription('sub_1')])
    const { scheduleAccountDeletion } = await importModule()

    await expect(scheduleAccountDeletion(USER_ID, ['site-1'], {} as never)).rejects.toMatchObject({ statusCode: 409 })

    expect(stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('refuses to close a blog that appeared after the confirmation', async () => {
    const { calls } = setup({ blogs: [blog(), blog({ id: 'new' })] })
    const { scheduleAccountDeletion } = await importModule()

    await expect(scheduleAccountDeletion(USER_ID, ['site-1'], {} as never)).rejects.toMatchObject({ statusCode: 409 })
    expect(calls).toEqual([])
  })

  it('keeps the deletion when Stripe is down and leaves billing to the hourly task', async () => {
    setup({ blogs: [paid()] })
    const stripe = stubStripe([activeSubscription('sub_1')])
    stripe.subscriptions.list.mockRejectedValueOnce(new Error('Stripe down'))
    const { scheduleAccountDeletion } = await importModule()

    await expect(scheduleAccountDeletion(USER_ID, ['site-1'], {} as never)).resolves.toBeDefined()
    expect(reportCaughtError).toHaveBeenCalled()
  })

  it('warns the other members of a closing blog', async () => {
    setup({ blogs: [blog({ tenantMemberships: [member(USER_ID, 'OWNER'), member('member')] })] })
    stubStripe()
    const { scheduleAccountDeletion } = await importModule()

    await scheduleAccountDeletion(USER_ID, ['site-1'], {} as never)

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'accountDeletionBlogClosing', to: 'm@example.test' }),
    )
  })

  it('keeps the deletion when a notification cannot be sent', async () => {
    setup()
    stubStripe()
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SES down'))
    const { scheduleAccountDeletion } = await importModule()

    await expect(scheduleAccountDeletion(USER_ID, [], {} as never)).resolves.toBeDefined()
    expect(reportCaughtError).toHaveBeenCalled()
  })
})

describe('restoreAccount', () => {
  const requestedAt = new Date('2026-11-05T10:00:00Z')
  const claims = { purpose: 'restore', userId: USER_ID, requestedAt: requestedAt.getTime(), exp: 9e15 } as const
  const account = { id: USER_ID, email: 'a@example.test', username: 'alice', language: 'en' }

  const setup = (user: object | null, blogs: object[] = []) => {
    const update = vi.fn(async () => ({}))
    const siteUpdateMany = vi.fn(async () => ({ count: 1 }))
    const siteUpdate = vi.fn(async (_args: unknown) => ({}))
    const findFirst = vi.fn(async () => user)
    const tx = {
      $queryRaw: vi.fn(async () => []),
      user: { findFirst, update },
      clientSite: { findMany: vi.fn(async () => blogs), updateMany: siteUpdateMany },
    }
    vi.stubGlobal('prisma', {
      $transaction: vi.fn(async (run: (client: unknown) => unknown) => run(tx)),
      clientSite: { findMany: vi.fn(async () => []), update: siteUpdate },
      user: { findMany: vi.fn(async () => []) },
    })
    return { update, siteUpdateMany, siteUpdate, findFirst }
  }

  it('reactivates the account, keeps its blogs open and resumes what the deletion ended', async () => {
    const { update, siteUpdateMany, siteUpdate } = setup(account, [{ id: 'site-1', closingSubscriptionIds: ['sub_1'] }])
    const stripe = stubStripe([activeSubscription('sub_1', { cancel_at_period_end: true })])
    const { restoreAccount } = await importModule()

    await expect(restoreAccount(claims, {} as never)).resolves.toEqual({ billing: 'resumed' })

    expect(update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { deletedAt: null, deletionRequestedAt: null, deletionScheduledFor: null, deletionReminderSentAt: null },
    })
    expect(siteUpdateMany).toHaveBeenCalledWith({ where: { id: { in: ['site-1'] } }, data: { closingAt: null } })
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_1', { cancel_at_period_end: false })
    expect(siteUpdate).toHaveBeenCalledWith({ where: { id: 'site-1' }, data: { closingSubscriptionIds: [] } })
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ template: 'accountDeletionRestored' }))
  })

  it('binds the link to this exact request, so an old link cannot restore a later deletion', async () => {
    const { update, findFirst } = setup(null)
    const { restoreAccount } = await importModule()

    await expect(restoreAccount(claims, {} as never)).resolves.toBe(false)

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: USER_ID, anonymizedAt: null, deletionRequestedAt: requestedAt }),
      }),
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('says a subscription that ended during the period has ended, without calling it a failure', async () => {
    setup(account, [{ id: 'site-1', closingSubscriptionIds: ['sub_1'] }])
    const stripe = stubStripe([activeSubscription('sub_1', { status: 'canceled' })])
    const { restoreAccount } = await importModule()

    await expect(restoreAccount(claims, {} as never)).resolves.toEqual({ billing: 'ended' })

    expect(stripe.subscriptions.update).not.toHaveBeenCalled()
    expect(reportCaughtError).not.toHaveBeenCalled()
  })

  it('treats a subscription Stripe no longer has as ended', async () => {
    setup(account, [{ id: 'site-1', closingSubscriptionIds: ['sub_1'] }])
    const stripe = stubStripe()
    stripe.subscriptions.retrieve.mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 'resource_missing' }))
    const { restoreAccount } = await importModule()

    await expect(restoreAccount(claims, {} as never)).resolves.toEqual({ billing: 'ended' })
  })

  it('restores the account on a Stripe failure and keeps the id for the hourly retry', async () => {
    const { siteUpdate } = setup(account, [{ id: 'site-1', closingSubscriptionIds: ['sub_1'] }])
    const stripe = stubStripe([activeSubscription('sub_1', { cancel_at_period_end: true })])
    stripe.subscriptions.update.mockRejectedValueOnce(new Error('Stripe down'))
    const { restoreAccount } = await importModule()

    await expect(restoreAccount(claims, {} as never)).resolves.toEqual({ billing: 'failed' })

    expect(siteUpdate).toHaveBeenCalledWith({ where: { id: 'site-1' }, data: { closingSubscriptionIds: ['sub_1'] } })
    expect(reportCaughtError).toHaveBeenCalled()
  })
})

describe('pendingDeletionSignIn', () => {
  const setup = (user: object | null) => {
    const findFirst = vi.fn(async () => user)
    vi.stubGlobal('prisma', { user: { findFirst } })
    return findFirst
  }

  it('sends a restore link for the right password and never opens anything itself', async () => {
    setup({ id: USER_ID, password: 'hash' })
    const { pendingDeletionSignIn } = await importModule()

    await expect(pendingDeletionSignIn('a@example.test', 'secret')).resolves.toBe(true)
    expect(consumeRateLimit).toHaveBeenCalledWith(`account-restore-offer:${USER_ID}`, 3, 3600)
  })

  it('says nothing about the account for a wrong password', async () => {
    setup({ id: USER_ID, password: 'hash' })
    argonVerify.mockResolvedValueOnce(false)
    const { pendingDeletionSignIn } = await importModule()

    await expect(pendingDeletionSignIn('a@example.test', 'wrong')).resolves.toBe(false)
    expect(consumeRateLimit).not.toHaveBeenCalled()
  })

  it('ignores accounts that are not waiting for deletion', async () => {
    const findFirst = setup(null)
    const { pendingDeletionSignIn } = await importModule()

    await expect(pendingDeletionSignIn('a@example.test', 'secret')).resolves.toBe(false)
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletionRequestedAt: { not: null } }) }),
    )
  })
})

describe('anonymizeAccount', () => {
  const now = new Date('2026-12-05T10:00:00Z')
  const person = { email: 'a@example.test', username: 'Jan Novák', avatarUrl: null }

  const setup = (user: object | null, blogs: object[] = [], billing: object[] = []) => {
    const executeRaw = vi.fn(async (..._args: unknown[]) => 1)
    const { tx, calls } = fakeTx({
      $executeRaw: executeRaw,
      user: {
        findFirst: vi.fn(async () => user),
        update: vi.fn(async (args: unknown) => calls.push({ model: 'user', method: 'update', args })),
      },
      clientSite: {
        findMany: vi.fn(async () => blogs),
        updateMany: vi.fn(async (args: unknown) => calls.push({ model: 'clientSite', method: 'updateMany', args })),
      },
      linkedinCompany: {
        findMany: vi.fn(async () => [{ id: 'li-1' }]),
        update: vi.fn(async (args: unknown) => calls.push({ model: 'linkedinCompany', method: 'update', args })),
      },
      shopifyConnection: {
        findMany: vi.fn(async () => [{ id: 'shop-1' }]),
        updateMany: vi.fn(async (args: unknown) =>
          calls.push({ model: 'shopifyConnection', method: 'updateMany', args }),
        ),
      },
    })
    vi.stubGlobal('prisma', {
      user: { findFirst: vi.fn(async () => (user ? { id: USER_ID } : null)) },
      clientSite: { findMany: vi.fn(async () => billing), update: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (run: (client: unknown) => unknown) => run(tx)),
    })
    return { calls, executeRaw }
  }

  it('does nothing for an account that was restored in the meantime', async () => {
    const { calls } = setup(null)
    const { anonymizeAccount } = await importModule()

    await expect(anonymizeAccount(USER_ID, now)).resolves.toBe(false)
    expect(calls).toEqual([])
  })

  it('stays due when Stripe fails, because nobody can cancel once the blog is gone', async () => {
    const billed = blog({ stripeCustomerId: 'cus_1' })
    const { calls } = setup(person, [], [billed])
    const stripe = stubStripe()
    stripe.subscriptions.list.mockRejectedValueOnce(new Error('Stripe down'))
    const { anonymizeAccount } = await importModule()

    await expect(anonymizeAccount(USER_ID, now)).rejects.toThrow('Stripe down')
    expect(calls).toEqual([])
  })

  it('ends any subscription still running before the blog closes', async () => {
    const billed = blog({ stripeCustomerId: 'cus_1' })
    setup(person, [], [billed])
    const stripe = stubStripe([activeSubscription('sub_late')])
    const { anonymizeAccount } = await importModule()

    await anonymizeAccount(USER_ID, now)

    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_late', { cancel_at_period_end: true })
  })

  it('removes personal fields from the row, and never deletes the row itself', async () => {
    const { calls } = setup(person)
    const { anonymizeAccount } = await importModule()

    await expect(anonymizeAccount(USER_ID, now)).resolves.toBe(true)

    const update = calls.find(({ model, method }) => model === 'user' && method === 'update')!.args
    expect(update.data).toMatchObject({
      username: 'deleted-1111111122223333',
      email: 'deleted-11111111222233334444555555555555@deleted.invalid',
      password: null,
      bio: null,
      avatarUrl: null,
      totpSecret: null,
      allowEmail: false,
      anonymizedAt: now,
    })
    expect(JSON.stringify(update.data)).not.toContain('a@example.test')
    expect(JSON.stringify(update.data)).not.toContain('Jan')
    expect(calls.some(({ model, method }) => model === 'user' && method.startsWith('delete'))).toBe(false)
    expect(calls.some(({ model, method }) => model === 'log' && method.startsWith('delete'))).toBe(false)
    expect(calls.some(({ model, method }) => model === 'article' && method.startsWith('delete'))).toBe(false)
  })

  it('removes what only made sense for the person', async () => {
    const { calls } = setup(person)
    const { anonymizeAccount } = await importModule()

    await anonymizeAccount(USER_ID, now)

    const removed = calls.filter(({ method }) => method === 'deleteMany').map(({ model }) => model)
    for (const model of [
      'session',
      'account',
      'verificationCode',
      'tenantMembership',
      'articleDraft',
      'notification',
      'follow',
      'commentReaction',
      'emojiReaction',
      'articleReaction',
      'articleFeedback',
      'userBan',
    ])
      expect(removed).toContain(model)
    expect(calls).toContainEqual({
      model: 'apiKey',
      method: 'updateMany',
      args: { where: { createdById: USER_ID }, data: { revokedAt: now, createdById: null } },
    })
    expect(calls).toContainEqual({
      model: 'pollResult',
      method: 'updateMany',
      args: { where: { userId: USER_ID }, data: { userId: null } },
    })
    expect(calls).toContainEqual({
      model: 'approval',
      method: 'updateMany',
      args: { where: { reviewerId: USER_ID }, data: { notes: null } },
    })
  })

  it("keeps generation rows for the blog's statistics, without what the person wrote", async () => {
    const { calls } = setup(person)
    const { anonymizeAccount } = await importModule()

    await anonymizeAccount(USER_ID, now)

    expect(calls.some(({ model, method }) => model === 'articleGenerationSession' && method === 'deleteMany')).toBe(
      false,
    )
    const scrub = calls.find(({ model }) => model === 'articleGenerationSession')!
    expect(scrub.args.data).toMatchObject({ prompt: '', options: {}, checkpoints: [], failureReason: null })
  })

  it('removes the name from revisions, its comments and the plain text in other people’s rows', async () => {
    const { calls, executeRaw } = setup(person)
    const { anonymizeAccount } = await importModule()

    await anonymizeAccount(USER_ID, now)

    expect(calls).toContainEqual({
      model: 'articleRevision',
      method: 'updateMany',
      args: { where: { actorId: USER_ID }, data: { actorName: null } },
    })
    const comment = calls.find(({ model, args }) => model === 'comment' && 'content' in args.data)!
    expect(comment.args.data.content).toBe('[deleted]')
    expect(comment.args.data).toHaveProperty('sentiment')
    const statements = executeRaw.mock.calls.map(([strings]) => (strings as string[]).join('?'))
    expect(statements.some((sql) => sql.includes('"Comment"'))).toBe(true)
    expect(statements.some((sql) => sql.includes('"Notification"'))).toBe(true)
    const values = executeRaw.mock.calls.flatMap(([, ...params]) => params)
    expect(values).toContain('@deleted-1111111122223333')
    expect(values.some((value) => typeof value === 'string' && value.includes('Jan Novák'))).toBe(true)
  })

  it('escapes the name, so a username cannot act as a regular expression', async () => {
    const { executeRaw } = setup({ ...person, username: 'a.b*(c' })
    const { anonymizeAccount } = await importModule()

    await anonymizeAccount(USER_ID, now)

    const values = executeRaw.mock.calls.flatMap(([, ...params]) => params)
    expect(values.some((value) => typeof value === 'string' && value.includes('a\\.b\\*\\(c'))).toBe(true)
  })

  it('closes a live blog, removes its provider connections and clears its caches', async () => {
    const { calls } = setup(person, [
      { id: 'site-1', domain: 'blog.example.com', deletedAt: null },
      { id: 'old', domain: 'old.example.com', deletedAt: new Date('2026-01-01') },
    ])
    const { anonymizeAccount } = await importModule()

    await anonymizeAccount(USER_ID, now)

    expect(calls).toContainEqual({
      model: 'clientSite',
      method: 'updateMany',
      args: { where: { id: { in: ['site-1'] } }, data: { deletedAt: now } },
    })
    expect(calls).toContainEqual({
      model: 'searchConsoleConnection',
      method: 'deleteMany',
      args: { where: { clientSiteId: { in: ['site-1', 'old'] } } },
    })
    expect(calls.find(({ model }) => model === 'linkedinCompany')?.args.data).toMatchObject({
      linkedinOrgId: 'deleted:li-1',
      accessToken: null,
    })
    expect(calls.find(({ model }) => model === 'shopifyConnection')?.args.data).toMatchObject({
      status: 'REVOKED',
      encryptedAccessToken: null,
    })
    expect(calls.find(({ model }) => model === 'shopifyPublication')?.args.data).toMatchObject({ status: 'FAILED' })
    expect(invalidateFeed).toHaveBeenCalledWith('site-1')
    expect(invalidateFeed).not.toHaveBeenCalledWith('old')
    expect(uncache).toHaveBeenCalledWith('host:blog.example.com', 'redirect:blog.example.com')
  })
})

describe('POST /api/users/deletion', () => {
  const setup = async (
    options: {
      role?: string
      password?: string | null
      totpSecret?: string | null
      blogs?: Blog[]
      totpResult?: string
      allowed?: boolean
      scheduledChange?: boolean
    } = {},
  ) => {
    const account = {
      id: USER_ID,
      email: 'alice@example.test',
      username: 'alice',
      language: 'en',
      role: options.role ?? 'admin',
      password: options.password === undefined ? 'hash' : options.password,
      totpSecret: options.totpSecret ?? null,
    }
    const schedule = vi.fn(async () => ({ scheduledFor: new Date('2026-12-05T10:00:00Z') }))
    const sendConfirm = vi.fn(async () => undefined)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getSessionUser', async () => ({ id: USER_ID, role: 'reader' }))
    vi.stubGlobal('consumeRateLimit', async () => options.allowed !== false)
    vi.stubGlobal('prisma', { user: { findFirst: vi.fn(async () => account) } })
    vi.stubGlobal('closingBlogs', async () => options.blogs ?? [])
    const module = await importModule()
    vi.stubGlobal('hasContractedBlog', module.hasContractedBlog)
    vi.stubGlobal('blogConfirmationsMatch', module.blogConfirmationsMatch)
    vi.stubGlobal('liveBlogIds', module.liveBlogIds)
    vi.stubGlobal('hasScheduledBillingChange', async () => options.scheduledChange ?? false)
    vi.stubGlobal('checkTotpCode', async () => options.totpResult ?? 'ok')
    vi.stubGlobal('scheduleAccountDeletion', schedule)
    vi.stubGlobal('sendDeletionConfirmEmail', sendConfirm)
    const handler = (await import('../../../server/api/users/deletion.post')).default as (event: never) => Promise<any>
    const run = (body: object) => {
      vi.stubGlobal('readValidatedBody', async (_: unknown, parse: (value: unknown) => unknown) => parse(body))
      return handler({} as never)
    }
    return { run, schedule, sendConfirm }
  }

  const valid = { email: 'alice@example.test', blogs: {}, password: 'secret' }

  it('schedules only after the email and password match', async () => {
    const { run, schedule } = await setup()

    await expect(run(valid)).resolves.toMatchObject({ status: 'scheduled' })
    expect(schedule).toHaveBeenCalledTimes(1)
  })

  it('accepts the email regardless of case but refuses a different one', async () => {
    const { run, schedule } = await setup()

    await expect(run({ ...valid, email: ' ALICE@example.test ' })).resolves.toMatchObject({ status: 'scheduled' })
    schedule.mockClear()
    await expect(run({ ...valid, email: 'bob@example.test' })).rejects.toMatchObject({ statusCode: 400 })
    expect(schedule).not.toHaveBeenCalled()
  })

  it('refuses a wrong or missing password', async () => {
    const { run, schedule } = await setup()

    argonVerify.mockResolvedValueOnce(false)
    await expect(run(valid)).rejects.toMatchObject({ statusCode: 400 })
    await expect(run({ ...valid, password: undefined })).rejects.toMatchObject({ statusCode: 400 })
    expect(schedule).not.toHaveBeenCalled()
  })

  it('needs a valid two-factor code when enabled', async () => {
    const { run, schedule } = await setup({ totpSecret: 'secret', totpResult: 'invalid' })

    await expect(run({ ...valid, totp: '000000' })).rejects.toMatchObject({ statusCode: 400 })
    expect(schedule).not.toHaveBeenCalled()
  })

  it('stops at the two-factor attempt limit', async () => {
    const { run } = await setup({ totpSecret: 'secret', totpResult: 'limited' })

    await expect(run({ ...valid, totp: '000000' })).rejects.toMatchObject({ statusCode: 429 })
  })

  it('needs every live blog typed out', async () => {
    const { run, schedule } = await setup({ blogs: [blog()] })

    await expect(run(valid)).rejects.toMatchObject({ statusCode: 400 })
    await expect(run({ ...valid, blogs: { 'site-1': 'wrong.example.com' } })).rejects.toMatchObject({ statusCode: 400 })
    expect(schedule).not.toHaveBeenCalled()
    await expect(run({ ...valid, blogs: { 'site-1': 'blog.example.com' } })).resolves.toMatchObject({
      status: 'scheduled',
    })
  })

  it('sends an OAuth-only account to its mailbox instead of deleting anything', async () => {
    const { run, schedule, sendConfirm } = await setup({ password: null, blogs: [blog()] })

    await expect(run({ email: 'alice@example.test', blogs: { 'site-1': 'blog.example.com' } })).resolves.toEqual({
      status: 'confirmation_sent',
    })
    expect(sendConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID }), ['site-1'], expect.anything())
    expect(schedule).not.toHaveBeenCalled()
  })

  it('passes the blogs that were typed out, so the schedule can refuse any others', async () => {
    const { run, schedule } = await setup({ blogs: [blog()] })

    await run({ ...valid, blogs: { 'site-1': 'blog.example.com' } })

    expect(schedule).toHaveBeenCalledWith(USER_ID, ['site-1'], expect.anything())
  })

  it('asks the customer to resolve a pending plan change first', async () => {
    const { run, schedule } = await setup({ scheduledChange: true })

    await expect(run(valid)).rejects.toMatchObject({ statusCode: 409 })
    expect(schedule).not.toHaveBeenCalled()
  })

  it('refuses a contracted blog, and a superadmin by the stored role', async () => {
    const contracted = await setup({ blogs: [blog({ plan: 'CUSTOM', paidTeamSeats: null })] })
    await expect(contracted.run(valid)).rejects.toMatchObject({ statusCode: 409 })

    const superadmin = await setup({ role: 'superadmin' })
    await expect(superadmin.run(valid)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('rate-limits repeated attempts', async () => {
    const { run, schedule } = await setup({ allowed: false })

    await expect(run(valid)).rejects.toMatchObject({ statusCode: 429 })
    expect(schedule).not.toHaveBeenCalled()
  })
})

describe('billing routes on a closing blog', () => {
  it.each(['subscribe', 'portal', 'seats', 'translation-languages', 'checkout'])(
    '%s refuses a closing blog',
    (route) => {
      const source = readFileSync(`server/api/stripe/${route}.post.ts`, 'utf8')

      expect(source).toContain('assertBlogNotClosing(')
    },
  )
})
