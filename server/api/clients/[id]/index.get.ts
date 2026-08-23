export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  const { user, membership } = await requireTenantMember(event, id)

  const clientSite = await prisma.clientSite.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: 'ai' },
        select: { id: true, username: true, bio: true, avatarUrl: true },
      },
      socials: true,
      features: {
        where: { isActive: true },
        include: {
          feature: {
            select: { code: true },
          },
        },
      },
      linkedinCompanies: {
        include: { brandProfile: true },
      },
    },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const activeFeatures = clientSite.features.map((cf) => cf.feature.code)

  const allowedFeatures = getAllowedFeatures(clientSite.plan)

  const base = {
    id: clientSite.id,
    name: clientSite.name,
    domain: clientSite.domain,
    logoUrl: clientSite.logoUrl,
    plan: clientSite.plan,
    billingPlan: clientSite.billingPlan,
    language: clientSite.language,
    activeFeatures,
    allowedFeatures,
  }
  const settings = hasTenantScope(membership, 'TENANT_SETTINGS')
    ? {
        focus: clientSite.focus,
        description: clientSite.description,
        generationFrequency: clientSite.generationFrequency,
        keywords: clientSite.keywords,
        audience: clientSite.audience,
        theme: clientSite.theme,
        allowShapes: clientSite.allowShapes,
        humanHourlyRateUsd: clientSite.humanHourlyRateUsd,
        humanWordsPerHour: clientSite.humanWordsPerHour,
      }
    : {}
  const integrations = hasTenantScope(membership, 'INTEGRATION_CONTROL')
    ? {
        socials: clientSite.socials,
        allowGtag: clientSite.allowGtag,
        gtagId: clientSite.gtagId,
        linkedinCompanies: clientSite.linkedinCompanies,
      }
    : {}
  const billing = hasTenantScope(membership, 'BILLING_CHANGE')
    ? {
        currency: clientSite.currency,
        annualPayment: clientSite.annualPayment,
        monthlyPayment: clientSite.monthlyPayment,
        firstPaidAt: clientSite.firstPaidAt,
        nextBillingAt: clientSite.nextBillingAt,
        lastInvoicedAt: clientSite.lastInvoicedAt,
        stripeCustomerId: clientSite.stripeCustomerId,
        stripeSubscriptionId: clientSite.stripeSubscriptionId,
      }
    : {}
  const ai = hasTenantScope(membership, 'AI_USE')
    ? {
        tokenLimit: clientSite.tokenLimit,
        tokenRemaining: clientSite.tokenRemaining,
        totalUsage: clientSite.totalUsage,
        autoRelease: clientSite.autoRelease,
        aiToneOfVoice: clientSite.aiToneOfVoice,
        aiControversyLevel: clientSite.aiControversyLevel,
        translationMode: clientSite.translationMode,
        translationLanguages: clientSite.translationLanguages,
        discloseAiContent: clientSite.discloseAiContent,
        aiUser: clientSite.users[0]
          ? {
              username: clientSite.users[0].username,
              bio: clientSite.users[0].bio,
              avatarUrl: clientSite.users[0].avatarUrl,
            }
          : null,
      }
    : {}

  return {
    ...base,
    ...settings,
    ...integrations,
    ...billing,
    ...ai,
    ...(hasTenantScope(membership, 'API_KEY_CONTROL') ? { apiKey: clientSite.apiKey } : {}),
    ...(user.role === 'superadmin' ? { allowAds: clientSite.allowAds, gamNetworkCode: clientSite.gamNetworkCode } : {}),
  }
})
