export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { minRole: 'admin' })

  if (!user.clientSiteId) return null
  if (user.role !== 'superadmin') await requireTenantMember(event, user.clientSiteId)

  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: {
      id: true,
      name: true,
      domain: true,
      domainVerified: true,
      plan: true,
      tokenLimit: true,
      tokenRemaining: true,
      totalUsage: true,
      createdAt: true,
      firstPaidAt: true,
      focus: true,
      audience: true,
      stripeSubscriptionId: true,
      users: {
        where: { role: 'ai' },
        take: 1,
        select: { username: true, avatarUrl: true },
      },
    },
  })

  if (!clientSite) return null

  const { stripeSubscriptionId, users, ...status } = clientSite

  return { ...status, aiUser: users[0] ?? null, hasActiveSubscription: !!stripeSubscriptionId }
})
