export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { minRole: 'admin' })

  if (!user.clientSiteId) return null
  if (user.role !== 'superadmin') await requireTenantMember(event, user.clientSiteId)
  const now = new Date()

  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: {
      id: true,
      name: true,
      description: true,
      logoUrl: true,
      language: true,
      domain: true,
      domainVerified: true,
      pendingDomain: true,
      plan: true,
      articleQuality: true,
      createdAt: true,
      trialStartedAt: true,
      trialEndsAt: true,
      trialAcknowledgedAt: true,
      firstPaidAt: true,
      focus: true,
      audience: true,
      aiToneOfVoice: true,
      autoRelease: true,
      generationFrequency: true,
      timeZone: true,
      releaseHour: true,
      releaseWindowStart: true,
      releaseWindowEnd: true,
      releaseDays: true,
      intervalMinHours: true,
      intervalMaxHours: true,
      allowGtag: true,
      gtagId: true,
      publishToShopify: true,
      publishToLinkedIn: true,
      features: {
        where: { isActive: true, feature: { code: { in: ['AI', 'ARTICLE_CRONS', 'SEARCH_CONSOLE'] } } },
        select: { feature: { select: { code: true } } },
      },
      searchConsoleConnection: { select: { status: true, propertyUrl: true, deletedAt: true } },
      shopifyConnection: { select: { status: true, blogId: true, deletedAt: true } },
      linkedinCompanies: {
        where: { deletedAt: null, accessToken: { not: null }, tokenExpiresAt: { gt: now } },
        select: { id: true },
        take: 1,
      },
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
        where: { role: 'ai', deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { username: true, bio: true, avatarUrl: true },
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
    features,
    searchConsoleConnection,
    shopifyConnection,
    linkedinCompanies,
    allowGtag,
    gtagId,
    autoRelease,
    generationFrequency,
    timeZone,
    releaseHour,
    releaseWindowStart,
    releaseWindowEnd,
    releaseDays,
    intervalMinHours,
    intervalMaxHours,
    publishToShopify,
    publishToLinkedIn,
    trialStartedAt: _trialStartedAt,
    trialEndsAt: _trialEndsAt,
    trialAcknowledgedAt: _trialAcknowledgedAt,
    ...status
  } = clientSite

  const [articleWallet, knowledgeSources, publishedArticle, members, invitations] = await Promise.all([
    getArticleCreditWallet(user.clientSiteId),
    db.knowledgeSource.findMany({
      where: { clientSiteId: clientSite.id, deletedAt: null },
      select: { status: true, useInArticles: true },
    }),
    db.article.findFirst({
      where: {
        clientSiteId: clientSite.id,
        deletedAt: null,
        status: 'published',
        OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }],
      },
      select: { id: true },
    }),
    db.tenantMembership.count({
      where: { clientSiteId: clientSite.id, deletedAt: null, user: { deletedAt: null, role: { not: 'ai' } } },
    }),
    db.tenantInvitation.count({
      where: {
        clientSiteId: clientSite.id,
        deletedAt: null,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    }),
  ])
  const activeFeatures = new Set(features?.map(({ feature }) => feature.code))
  const scheduled = activeFeatures.has('AI') && activeFeatures.has('ARTICLE_CRONS') && generationFrequency !== 'NONE'
  const scheduleValid =
    !scheduled ||
    !releaseScheduleError({
      ...{
        timeZone,
        releaseHour,
        releaseWindowStart,
        releaseWindowEnd,
        releaseDays,
        intervalMinHours,
        intervalMaxHours,
      },
      frequency: generationFrequency as ReleaseFrequency,
    })
  const measurement = {
    analytics: allowGtag === true && !!gtagId?.trim(),
    searchConsole:
      activeFeatures.has('SEARCH_CONSOLE') &&
      searchConsoleConnection?.status === 'CONNECTED' &&
      !searchConsoleConnection.deletedAt &&
      !!searchConsoleConnection.propertyUrl?.trim(),
  }
  const channels = {
    shopify:
      publishToShopify === true &&
      shopifyConnection?.status === 'CONNECTED' &&
      !shopifyConnection.deletedAt &&
      !!shopifyConnection.blogId,
    linkedin: publishToLinkedIn === true && !!linkedinCompanies?.length,
  }
  const knowledge = { indexed: 0, processing: 0, failed: 0 }
  for (const source of knowledgeSources) {
    if (!source.useInArticles) continue
    if (source.status === 'INDEXED') knowledge.indexed++
    else if (source.status === 'FAILED') knowledge.failed++
    else knowledge.processing++
  }
  const draftArticle =
    !publishedArticle && (user.role === 'superadmin' || user.scopes?.includes('ARTICLE_WRITE'))
      ? await db.article.findFirst({
          where: { clientSiteId: clientSite.id, deletedAt: null, status: 'draft' },
          orderBy: { updatedAt: 'desc' },
          select: { slug: true },
        })
      : null
  // Onboarding records why a new site started without a trial; nothing on the site row says so.
  const repeatInbox =
    clientSite.plan === 'BASIC' &&
    !clientSite.trialStartedAt &&
    (await db.log.count({ where: { clientSiteId: clientSite.id, action: 'TRIAL_REPEAT_INBOX' } })) > 0
  return {
    ...status,
    articlesRemaining: articleWallet.available,
    articleWallet,
    knowledgeSources: knowledgeSources.length,
    setup: {
      hasPublishedArticle: Boolean(publishedArticle),
      draftArticleSlug: draftArticle?.slug ?? null,
      knowledge,
      publishing: { automatic: autoRelease === true, scheduled, scheduleValid },
      measurement,
      team: { members, invitations },
      channels,
    },
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
