export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !['superadmin', 'admin'].includes(user.role))
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing client ID' })

  const { code, enabled } = await readBody<{ code: 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS'; enabled: boolean }>(event)

  const now = new Date()
  const billingLockedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const clientSiteBefore = await prisma.clientSite.findUnique({
    where: { id },
    include: {
      users: { where: { role: 'ai' }, select: { id: true, username: true, bio: true, avatarUrl: true }, take: 1 },
      socials: true,
      features: { include: { feature: { select: { id: true, code: true, priceMonthly: true, priceAnnual: true } } } },
    },
  })

  if (!clientSiteBefore) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const oldMonthly = clientSiteBefore.monthlyPayment ?? 0
  const oldAnnual = clientSiteBefore.annualPayment ?? 0

  await prisma.$transaction(async (tx) => {
    const feature = await tx.feature.findUnique({ where: { code } })
    if (!feature) return

    const current = clientSiteBefore.features.find((cf) => cf.feature.code === code)

    if (enabled) {
      if (current) {
        if (!current.isActive) {
          await tx.clientFeature.update({
            where: { id: current.id },
            data: {
              isActive: true,
              deactivatedAt: null,
              billingLockedUntil:
                current.billingLockedUntil && current.billingLockedUntil > now
                  ? current.billingLockedUntil
                  : billingLockedUntil,
            },
          })
        }
      } else {
        await tx.clientFeature.create({
          data: {
            clientSiteId: id,
            featureId: feature.id,
            billingLockedUntil,
          },
        })
      }
    } else if (current?.isActive) {
      await tx.clientFeature.update({
        where: { id: current.id },
        data: { isActive: false, deactivatedAt: now },
      })
    }

    const billedFeatures = await tx.clientFeature.findMany({
      where: { clientSiteId: id, billingLockedUntil: { gt: now } },
      include: { feature: { select: { priceMonthly: true } } },
    })

    const monthlyTotal = billedFeatures.reduce((sum, cf) => sum + cf.feature.priceMonthly, 0)

    const annualTotal =
      clientSiteBefore.billingPlan === 'ANNUAL' ? Math.round(monthlyTotal * 12 * 0.8) : monthlyTotal * 12

    await tx.clientSite.update({
      where: { id },
      data: {
        monthlyPayment: clientSiteBefore.billingPlan === 'PERMANENT' ? 0 : monthlyTotal,
        annualPayment: clientSiteBefore.billingPlan === 'PERMANENT' ? 0 : annualTotal,
      },
    })
  })

  const clientSiteAfter = await prisma.clientSite.findUnique({
    where: { id },
    include: {
      users: { where: { role: 'ai' }, select: { id: true, username: true, bio: true, avatarUrl: true }, take: 1 },
      socials: true,
      features: { where: { isActive: true }, include: { feature: { select: { code: true } } } },
    },
  })

  const newMonthly = clientSiteAfter!.monthlyPayment ?? 0
  const newAnnual = clientSiteAfter!.annualPayment ?? 0
  const activeFeatureCodes = clientSiteAfter!.features.map((f) => f.feature.code)

  await logAction({
    action: 'CLIENT_FEATURE_TOGGLE',
    userId: user.id,
    clientSiteId: id,
    metadata: {
      toggledFeature: code,
      enabled,
      plan: clientSiteBefore.plan,
      billingPlan: clientSiteBefore.billingPlan,
      monthlyBefore: oldMonthly,
      monthlyAfter: newMonthly,
      annualBefore: oldAnnual,
      annualAfter: newAnnual,
      activeFeatures: activeFeatureCodes,
    },
    ip: getRequestIP(event),
  })

  const allowedFeatures = {
    AI: ['PRO', 'PREMIUM', 'CUSTOM'].includes(clientSiteAfter!.plan),
    SENTIMENT: ['PREMIUM', 'CUSTOM'].includes(clientSiteAfter!.plan),
    ARTICLE_CRONS: ['PRO', 'PREMIUM', 'CUSTOM'].includes(clientSiteAfter!.plan),
  }

  const aiUser = clientSiteAfter!.users[0]
    ? {
        username: clientSiteAfter!.users[0].username,
        bio: clientSiteAfter!.users[0].bio ?? null,
        avatarUrl: clientSiteAfter!.users[0].avatarUrl ?? null,
      }
    : null

  return {
    ...clientSiteAfter,
    activeFeatures: activeFeatureCodes,
    allowedFeatures,
    aiUser,
  }
})
