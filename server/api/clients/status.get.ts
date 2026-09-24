export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { minRole: 'admin' })

  if (!user.clientSiteId) return null
  if (user.role !== 'superadmin') await requireTenantMember(event, user.clientSiteId)

  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: {
      id: true,
      name: true,
      language: true,
      domain: true,
      domainVerified: true,
      plan: true,
      createdAt: true,
      trialStartedAt: true,
      trialEndsAt: true,
      trialAcknowledgedAt: true,
      firstPaidAt: true,
      focus: true,
      audience: true,
      theme: true,
      typographyPreset: true,
      discloseAiContent: true,
      stripeSubscriptionId: true,
      users: {
        where: { role: 'ai' },
        take: 1,
        select: { username: true, avatarUrl: true },
      },
    },
  })

  if (!clientSite) return null

  const state = trialState(clientSite)
  const endsAt = clientSite.trialEndsAt?.toISOString() ?? null
  const daysLeft = state === 'ACTIVE' ? trialDaysLeft(clientSite) : 0
  const {
    stripeSubscriptionId,
    users,
    trialStartedAt: _trialStartedAt,
    trialEndsAt: _trialEndsAt,
    trialAcknowledgedAt: _trialAcknowledgedAt,
    ...status
  } = clientSite

  const articleWallet = await getArticleCreditWallet(user.clientSiteId)
  return {
    ...status,
    articlesRemaining: articleWallet.available,
    articleWallet,
    aiUser: users[0] ?? null,
    hasActiveSubscription: !!stripeSubscriptionId,
    trial: {
      state,
      endsAt,
      daysLeft,
    },
  }
})
