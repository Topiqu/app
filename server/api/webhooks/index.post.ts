import { z } from 'zod'
import { MAX_WEBHOOKS } from '~~/shared/utils/webhooks'
import { assertPublicWebhookUrl, webhookEventsSchema, webhookUrlSchema } from '~~/server/utils/webhookInput'

export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireWebhookAccess(event)
  const body = await readValidatedBody(
    event,
    z.object({ url: webhookUrlSchema, events: webhookEventsSchema }).parse,
  )

  if ((await db.webhook.count({ where: { clientSiteId } })) >= MAX_WEBHOOKS)
    throw createError({ statusCode: 409, message: `At most ${MAX_WEBHOOKS} webhooks per site` })
  await assertPublicWebhookUrl(body.url)

  const secret = webhookSecret()
  const webhook = await db.webhook.create({
    data: { clientSiteId, url: body.url, events: body.events, secret },
    select: WEBHOOK_VIEW,
  })
  await logAction({
    action: 'WEBHOOK_CREATED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { webhookId: webhook.id, events: body.events },
  })
  // The only time the secret leaves the server besides a rotation.
  return { webhook, secret }
})
