import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const { db, clientSiteId } = await requireWebhookAccess(event)
  const id = getRouterParam(event, 'id')!

  if (!(await consumeRateLimit(`webhook-test:${clientSiteId}`, 10, 60)))
    throw createError({ statusCode: 429, message: 'Too many test deliveries' })

  const webhook = await db.webhook.findFirst({ where: { id, clientSiteId }, omit: { secret: false } })
  if (!webhook) throw createError({ statusCode: 404, message: 'Webhook not found' })

  const payload = { type: 'ping', createdAt: new Date().toISOString(), data: { webhookId: id } }
  const result = await sendWebhookRequest(
    webhook.url,
    webhook.secret,
    `test_${randomUUID()}`,
    JSON.stringify(payload),
    'ping',
  )
  // The transport error can name internal resolution details; the status code is what the tenant can act on.
  return { ok: result.ok, status: result.status }
})
