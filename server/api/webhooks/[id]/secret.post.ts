export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireWebhookAccess(event)
  const id = getRouterParam(event, 'id')!

  const secret = webhookSecret()
  const rotated = await db.webhook.updateMany({ where: { id, clientSiteId }, data: { secret } })
  if (!rotated.count) throw createError({ statusCode: 404, message: 'Webhook not found' })
  await logAction({
    action: 'WEBHOOK_SECRET_ROTATED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { webhookId: id },
  })
  return { secret }
})
