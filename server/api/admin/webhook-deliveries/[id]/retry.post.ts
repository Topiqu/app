import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: 'superadmin' })
  requireSameAuthOrigin(event)
  const { translate: t } = await useServerI18n(event)
  const { id } = await getValidatedRouterParams(event, z.object({ id: z.string().uuid() }).parse)
  await readValidatedBody(event, z.object({ confirmDuplicateRisk: z.literal(true) }).strict().parse)
  if (!(await consumeRateLimit(`operations:webhook-retry:${user.id}`, 10, 600)))
    throw createError({ statusCode: 429, message: t('operations.retryRateLimited')! })

  const delivery = await db.webhookDelivery.findFirst({
    where: { id, deletedAt: null, status: 'FAILED', clientSite: { deletedAt: null } },
    select: { id: true, clientSiteId: true, attempts: true },
  })
  if (!delivery) throw createError({ statusCode: 409, message: t('operations.retryConflict')! })

  // Delivery writes are system-only. Requeue the same immutable event; the existing worker owns the send and lease.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.webhookDelivery.updateMany({
      where: {
        id: delivery.id,
        clientSiteId: delivery.clientSiteId,
        deletedAt: null,
        status: 'FAILED',
        attempts: delivery.attempts,
        webhook: { active: true, deletedAt: null },
        clientSite: { deletedAt: null, plan: { not: 'BASIC' } },
      },
      data: { status: 'PENDING', nextAttemptAt: new Date() },
    })
    if (updated.count !== 1) throw createError({ statusCode: 409, message: t('operations.retryConflict')! })
    await logAction({
      action: 'WEBHOOK_DELIVERY_RETRY_QUEUED',
      userId: user.id,
      clientSiteId: delivery.clientSiteId,
      ip: getIp(event),
      metadata: { deliveryId: delivery.id, previousAttempts: delivery.attempts },
      tx,
    })
  })
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return { queued: true }
})
