import type { H3Event } from 'h3'
import type { Language } from '~~/generated/zenstack/models'

import { articlePath } from '~~/shared/utils/routes'
import { createHmac, randomBytes } from 'node:crypto'
import { postPublicUrl } from '~~/server/utils/images/publicFetch'
import { webhookEventType, type WebhookEventCode } from '~~/shared/utils/webhooks'

/** Minutes before each retry; the delivery fails for good after the last one. */
export const WEBHOOK_RETRY_MINUTES = [1, 5, 30, 120, 720]
export const WEBHOOK_DISABLE_AFTER = 20
const SEND_LEASE_MS = 5 * 60_000
const SEND_CONCURRENCY = 10

export const WEBHOOK_VIEW = {
  id: true,
  url: true,
  events: true,
  active: true,
  failureStreak: true,
  disabledAt: true,
  lastDeliveryAt: true,
  lastStatusCode: true,
  createdAt: true,
} as const

/** Endpoints are Pro+; a downgraded tenant may still list and delete theirs (`requirePlan: false`). */
export const requireWebhookAccess = async (event: H3Event, { requirePlan = true } = {}) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  const clientSiteId = user.clientSiteId!
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', clientSiteId)
  if (requirePlan) {
    const site = await db.clientSite.findUnique({ where: { id: clientSiteId }, select: { plan: true } })
    if (!site || site.plan === 'BASIC') throw createError({ statusCode: 403, message: 'Webhooks require the Pro plan' })
  }
  return { user, db, clientSiteId }
}

export const webhookSecret = () => `whsec_${randomBytes(24).toString('base64url')}`

/** Stripe-style `t=…,v1=…`: the timestamp is signed with the body so a captured request cannot be replayed later. */
export const signWebhook = (secret: string, timestamp: number, body: string) =>
  `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`

export const webhookRetryAt = (attempts: number, now: Date) => {
  const minutes = WEBHOOK_RETRY_MINUTES[attempts - 1]
  return minutes === undefined ? null : new Date(now.getTime() + minutes * 60_000)
}

type ArticleRef = { id: string; clientSiteId: string; slug?: string | null; language?: string | null }

const articleData = async (event: WebhookEventCode, ref: ArticleRef) => {
  if (event === 'ARTICLE_UNPUBLISHED' || event === 'ARTICLE_DELETED')
    return { article: { id: ref.id, slug: ref.slug ?? null, language: ref.language ?? null } }

  const row = await prisma.article.findFirst({
    where: { id: ref.id, clientSiteId: ref.clientSiteId, status: 'published' },
    select: { ...externalArticleSelect, clientSite: { select: { domain: true, language: true } } },
  })
  if (!row) return null
  const { clientSite, ...article } = row
  const flat = flattenExternalArticle(article, clientSite.language)
  return {
    article: { ...flat, url: `https://${clientSite.domain}${articlePath(flat.language as Language, flat.slug)}` },
  }
}

/** Best-effort like follower notifications: a failure is logged and never fails the article write. */
export const enqueueArticleWebhook = async (event: WebhookEventCode, ref: ArticleRef) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        clientSiteId: ref.clientSiteId,
        active: true,
        deletedAt: null,
        events: { has: event },
        clientSite: { plan: { not: 'BASIC' } },
      },
      select: { id: true },
    })
    if (!webhooks.length) return
    const data = await articleData(event, ref)
    if (!data) return
    const payload = JSON.parse(
      JSON.stringify({ type: webhookEventType(event), createdAt: new Date().toISOString(), data }),
    )
    await prisma.webhookDelivery.createMany({
      data: webhooks.map((webhook) => ({ webhookId: webhook.id, clientSiteId: ref.clientSiteId, event, payload })),
    })
    // The task retries whatever this first attempt leaves behind.
    deliverDueWebhooks().catch((error) => console.error('[webhooks] Immediate delivery failed:', error))
  } catch (error) {
    console.error('[webhooks] Enqueue failed:', error)
  }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500)

export const sendWebhookRequest = async (
  url: string,
  secret: string,
  deliveryId: string,
  body: string,
  type: string,
) => {
  try {
    const response = await postPublicUrl(url, body, {
      'Content-Type': 'application/json',
      'Topiqu-Delivery': deliveryId,
      'Topiqu-Event': type,
      'Topiqu-Signature': signWebhook(secret, Math.floor(Date.now() / 1000), body),
    })
    await response.body?.cancel()
    return { status: response.status, ok: response.status >= 200 && response.status < 300, error: null }
  } catch (error) {
    return { status: null, ok: false, error: errorText(error) }
  }
}

const sendDelivery = async (id: string) => {
  const now = new Date()
  // The lease doubles as crash recovery: a SENDING row whose lease ran out is due again.
  const claimed = await prisma.webhookDelivery.updateMany({
    where: { id, status: 'PENDING', nextAttemptAt: { lte: now } },
    data: { status: 'SENDING', attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + SEND_LEASE_MS) },
  })
  if (!claimed.count) return null

  const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
    where: { id },
    select: { attempts: true, payload: true, webhookId: true },
  })
  const webhook = await prisma.webhook.findUnique({ where: { id: delivery.webhookId }, omit: { secret: false } })
  if (!webhook?.active || webhook.deletedAt) {
    await prisma.webhookDelivery.update({
      where: { id },
      data: { status: 'FAILED', nextAttemptAt: now, lastError: 'Endpoint disabled' },
    })
    return false
  }

  const payload = delivery.payload as { type: string }
  const result = await sendWebhookRequest(webhook.url, webhook.secret, id, JSON.stringify(payload), payload.type)
  const finishedAt = new Date()
  const retryAt = result.ok ? null : webhookRetryAt(delivery.attempts, finishedAt)
  await prisma.webhookDelivery.update({
    where: { id },
    data: {
      status: result.ok ? 'SUCCEEDED' : retryAt ? 'PENDING' : 'FAILED',
      nextAttemptAt: retryAt ?? finishedAt,
      deliveredAt: result.ok ? finishedAt : null,
      lastStatusCode: result.status,
      lastError: result.ok ? null : (result.error ?? `HTTP ${result.status}`),
    },
  })
  await prisma.webhook.update({
    where: { id: delivery.webhookId },
    data: {
      lastDeliveryAt: finishedAt,
      lastStatusCode: result.status,
      failureStreak: result.ok ? 0 : { increment: 1 },
    },
  })
  if (!result.ok)
    await prisma.webhook.updateMany({
      where: { id: delivery.webhookId, active: true, failureStreak: { gte: WEBHOOK_DISABLE_AFTER } },
      data: { active: false, disabledAt: finishedAt },
    })
  return result.ok
}

export const deliverDueWebhooks = async (limit = 50) => {
  const now = new Date()
  await prisma.webhookDelivery.updateMany({
    where: { status: 'SENDING', nextAttemptAt: { lt: now } },
    data: { status: 'PENDING' },
  })
  const due = await prisma.webhookDelivery.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
    select: { id: true },
  })

  let delivered = 0
  let failed = 0
  for (let i = 0; i < due.length; i += SEND_CONCURRENCY) {
    const results = await Promise.all(due.slice(i, i + SEND_CONCURRENCY).map(({ id }) => sendDelivery(id)))
    delivered += results.filter((ok) => ok === true).length
    failed += results.filter((ok) => ok === false).length
  }
  return { due: due.length, delivered, failed }
}
