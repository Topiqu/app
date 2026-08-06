export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { minRole: 'admin' })

  if (!user.clientSiteId) return null

  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: {
      id: true,
      plan: true,
      tokenLimit: true,
      tokenRemaining: true,
      totalUsage: true,
      createdAt: true,
      firstPaidAt: true,
      focus: true,
      audience: true,
      stripeSubscriptionId: true,
    },
  })

  if (!clientSite) return null

  const { stripeSubscriptionId, ...status } = clientSite

  return { ...status, hasActiveSubscription: !!stripeSubscriptionId }
})
