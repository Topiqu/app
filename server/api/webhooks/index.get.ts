export default defineEventHandler(async (event) => {
  const { db, clientSiteId } = await requireWebhookAccess(event, { requirePlan: false })
  const webhooks = await db.webhook.findMany({
    where: { clientSiteId },
    select: WEBHOOK_VIEW,
    orderBy: { createdAt: 'asc' },
  })
  return { webhooks }
})
