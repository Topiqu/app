export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !['superadmin', 'admin'].includes(user.role))
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const clientId = getRouterParam(event, 'id')
  if (!clientId) throw createError({ statusCode: 400, message: 'Missing client ID' })

  if (user.role === 'admin' && user.clientSiteId !== clientId)
    throw createError({ statusCode: 403, message: t('common.errors.unauthorized')! })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'BILLING_CHANGE', clientId)

  const { code, enabled } = await readBody<{ code: FeatureCode; enabled: boolean }>(event)

  if (!FEATURE_CODES.includes(code))
    throw createError({ statusCode: 400, message: t('common.errors.invalidFeature') ?? 'Invalid feature' })

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
    const activeBefore = await tx.clientFeature
      .findMany({
        where: { clientSiteId: clientId, isActive: true },
        select: { feature: { select: { code: true } } },
      })
      .then((r) => r.map((x) => x.feature.code as FeatureCode))

    if (enabled) {
      if (!getAllowedFeatures(before.plan)[code])
        throw createError({ statusCode: 403, message: t('common.errors.featureNotInPlan') ?? 'Feature not in plan' })

      if (getMissingDependencies(code, activeBefore).length)
        throw createError({ statusCode: 400, message: t('common.errors.aiRequired') ?? 'Enable AI first' })
    }

    const setFeature = async (featureCode: FeatureCode, isActive: boolean) => {
      const feature = await tx.feature.findUnique({ where: { code: featureCode } })
      if (!feature) {
        if (featureCode === code)
          throw createError({ statusCode: 400, message: t('common.errors.invalidFeature') ?? 'Invalid feature' })
        return
      }

      const current = await tx.clientFeature.findFirst({
        where: { clientSiteId: clientId, featureId: feature.id },
      })

      if (isActive) {
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
                    : lockUntil,
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
    }

    await setFeature(code, enabled)

    if (!enabled) {
      for (const dep of getDependents(code)) await setFeature(dep, false)
    }

    const activeFeatures = await tx.clientFeature
      .findMany({
        where: { clientSiteId: clientId, isActive: true },
        select: { feature: { select: { code: true } } },
      })
      .then((r) => r.map((x) => x.feature.code as FeatureCode))

    await syncAutoRelease(tx, clientId, activeFeatures)
    await syncSeoAutopilot(tx, clientId, activeFeatures)

    const { monthlyPayment, annualPayment } = await recalcFeatureBilling(
      tx,
      clientId,
      before.plan,
      before.billingPlan,
      now,
    )

    return { activeFeatures, monthlyPayment, annualPayment }
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
