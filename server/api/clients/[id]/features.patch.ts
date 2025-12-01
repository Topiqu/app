export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !['superadmin', 'admin'].includes(user.role))
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const clientId = getRouterParam(event, 'id')
  if (!clientId) throw createError({ statusCode: 400, message: 'Missing client ID' })

  const { code, enabled } = await readBody<{ code: 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS'; enabled: boolean }>(event)

  const now = new Date()
  const lockUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const before = await prisma.clientSite.findUnique({
    where: { id: clientId },
    select: {
      plan: true,
      billingPlan: true,
      monthlyPayment: true,
      annualPayment: true,
    },
  })

  if (!before) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const oldMonthly = before.monthlyPayment ?? 0
  const oldAnnual = before.annualPayment ?? 0

  const result = await prisma.$transaction(async (tx) => {
    const feature = await tx.feature.findUnique({ where: { code } })
    if (!feature)
      throw createError({ statusCode: 400, message: t('common.errors.invalidFeature') ?? 'Invalid feature' })

    const current = await tx.clientFeature.findFirst({
      where: { clientSiteId: clientId, featureId: feature.id },
    })

    if (enabled) {
      if (current) {
        if (!current.isActive) {
          await tx.clientFeature.update({
            where: { id: current.id },
            data: {
              isActive: true,
              deactivatedAt: null,
              billingLockedUntil:
                current.billingLockedUntil && current.billingLockedUntil > now ? current.billingLockedUntil : lockUntil,
            },
          })
        }
      } else {
        await tx.clientFeature.create({
          data: { clientSiteId: clientId, featureId: feature.id, billingLockedUntil: lockUntil },
        })
      }
    } else if (current?.isActive) {
      await tx.clientFeature.update({
        where: { id: current.id },
        data: { isActive: false, deactivatedAt: now },
      })
    }

    const activeFeatures = await tx.clientFeature
      .findMany({
        where: { clientSiteId: clientId, isActive: true },
        select: { feature: { select: { code: true } } },
      })
      .then((r) => r.map((x) => x.feature.code))

    const billed = await tx.clientFeature.findMany({
      where: { clientSiteId: clientId, billingLockedUntil: { gt: now } },
      include: { feature: { select: { priceMonthly: true } } },
    })

    const monthlyTotal = billed.reduce((s, cf) => s + cf.feature.priceMonthly, 0)
    const annualTotal = before.billingPlan === 'ANNUAL' ? Math.round(monthlyTotal * 12 * 0.8) : monthlyTotal * 12

    await tx.clientSite.update({
      where: { id: clientId },
      data: {
        monthlyPayment: before.billingPlan === 'PERMANENT' ? 0 : monthlyTotal,
        annualPayment: before.billingPlan === 'PERMANENT' ? 0 : annualTotal,
      },
    })

    return { activeFeatures, monthlyPayment: monthlyTotal, annualPayment: annualTotal }
  })

  await logAction({
    action: 'CLIENT_FEATURE_TOGGLE',
    userId: user.id,
    clientSiteId: clientId,
    metadata: {
      toggledFeature: code,
      enabled,
      plan: before.plan,
      billingPlan: before.billingPlan,
      monthlyBefore: oldMonthly,
      monthlyAfter: result.monthlyPayment,
      annualBefore: oldAnnual,
      annualAfter: result.annualPayment,
      activeFeatures: result.activeFeatures,
    },
    ip: getRequestIP(event),
  })

  return result
})
