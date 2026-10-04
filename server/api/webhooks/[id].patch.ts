import { z } from 'zod'
import { assertPublicWebhookUrl, webhookEventsSchema, webhookUrlSchema } from '~~/server/utils/webhookInput'

export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireWebhookAccess(event)
  const id = getRouterParam(event, 'id')!
  const body = await readValidatedBody(
    event,
    z.object({ url: webhookUrlSchema.optional(), events: webhookEventsSchema.optional(), active: z.boolean().optional() })
      .parse,
  )

  const existing = await db.webhook.findFirst({ where: { id, clientSiteId }, select: { id: true } })
  if (!existing) throw createError({ statusCode: 404, message: 'Webhook not found' })
  if (body.url) await assertPublicWebhookUrl(body.url)

  const webhook = await db.webhook.update({
    where: { id },
    data: {
      ...body,
      // Re-enabling gives an auto-disabled endpoint a clean slate.
      ...(body.active ? { failureStreak: 0, disabledAt: null } : {}),
    },
    select: WEBHOOK_VIEW,
  })
  await logAction({
    action: 'WEBHOOK_UPDATED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { webhookId: id, updatedFields: Object.keys(body) },
  })
  return { webhook }
})
