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
      websiteUrl: true,
      theme: true,
      typographyPreset: true,
      accentColor: true,
      brandGradient: true,
      headingFontUrl: true,
      bodyFontUrl: true,
      discloseAiContent: true,
      publishToWeb: true,
      stripeSubscriptionId: true,
      billingProvider: true,
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

  const [articleWallet, knowledgeSources] = await Promise.all([
    getArticleCreditWallet(user.clientSiteId),
    db.knowledgeSource.count({ where: { clientSiteId: clientSite.id, deletedAt: null } }),
  ])
  // Onboarding records why a new site started without a trial; nothing on the site row says so.
  const repeatInbox =
    clientSite.plan === 'BASIC' &&
    !clientSite.trialStartedAt &&
    (await db.log.count({ where: { clientSiteId: clientSite.id, action: 'TRIAL_REPEAT_INBOX' } })) > 0
  return {
    ...status,
    articlesRemaining: articleWallet.available,
    articleWallet,
    knowledgeSources,
    aiUser: users[0] ?? null,
    hasActiveSubscription: !!stripeSubscriptionId,
    trial: {
      state,
      endsAt,
      daysLeft,
      repeatInbox,
    },
  }
})
