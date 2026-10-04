export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireWebhookAccess(event, { requirePlan: false })
  const id = getRouterParam(event, 'id')!

  const deleted = await db.webhook.deleteMany({ where: { id, clientSiteId } })
  if (!deleted.count) throw createError({ statusCode: 404, message: 'Webhook not found' })
  await logAction({ action: 'WEBHOOK_DELETED', userId: user.id, clientSiteId, ip: getIp(event), metadata: { webhookId: id } })
  return { success: true }
})
