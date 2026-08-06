import type { ClientPlan } from '@prisma/client'

export type FeatureCode = 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS'

type FeatureDb = {
  clientFeature: {
    count: (args: any) => Promise<any>
    findMany: (args: any) => Promise<any[]>
    upsert: (args: any) => Promise<unknown>
    updateMany: (args: any) => Promise<unknown>
  }
  feature: {
    findMany: (args: any) => Promise<any[]>
  }
}

export const FEATURE_CODES: FeatureCode[] = ['AI', 'SENTIMENT', 'ARTICLE_CRONS']

export const FEATURE_DEPENDENCIES: Record<FeatureCode, FeatureCode[]> = {
  AI: [],
  SENTIMENT: ['AI'],
  ARTICLE_CRONS: ['AI'],
}

export const getAllowedFeatures = (plan: ClientPlan): Record<FeatureCode, boolean> => ({
  AI: ['PRO', 'PREMIUM', 'CUSTOM'].includes(plan),
  SENTIMENT: ['PREMIUM', 'CUSTOM'].includes(plan),
  ARTICLE_CRONS: ['PRO', 'PREMIUM', 'CUSTOM'].includes(plan),
})

export const isAlaCartePlan = (plan: ClientPlan): boolean => plan === 'CUSTOM'

export const getMissingDependencies = (code: FeatureCode, active: FeatureCode[]): FeatureCode[] =>
  FEATURE_DEPENDENCIES[code].filter((dep) => !active.includes(dep))

export const getDependents = (code: FeatureCode): FeatureCode[] =>
  FEATURE_CODES.filter((c) => FEATURE_DEPENDENCIES[c].includes(code))

export const billableMonthlyTotal = (plan: ClientPlan, billingPlan: string, billedPrices: number[]): number =>
  isAlaCartePlan(plan) && billingPlan !== 'PERMANENT' ? billedPrices.reduce((sum, price) => sum + price, 0) : 0

export const activeFeatureFilter = (code: FeatureCode) => ({
  features: { some: { isActive: true, feature: { code } } },
})

export const hasActiveFeature = async (tx: FeatureDb, clientSiteId: string, code: FeatureCode): Promise<boolean> =>
  (await tx.clientFeature.count({
    where: { clientSiteId, isActive: true, feature: { code } },
  })) > 0

export type PlanFeatureSync = { activate: FeatureCode[]; deactivate: FeatureCode[] }

export const planFeatureSync = (plan: ClientPlan, active: FeatureCode[]): PlanFeatureSync => {
  if (isAlaCartePlan(plan)) return { activate: [], deactivate: [] }

  const allowed = getAllowedFeatures(plan)

  return {
    activate: FEATURE_CODES.filter((code) => allowed[code] && !active.includes(code)),
    deactivate: FEATURE_CODES.filter((code) => !allowed[code] && active.includes(code)),
  }
}

export const syncPlanFeatures = async (tx: FeatureDb, clientSiteId: string, plan: ClientPlan) => {
  const active = await tx.clientFeature
    .findMany({
      where: { clientSiteId, isActive: true },
      select: { feature: { select: { code: true } } },
    })
    .then((rows) => rows.map((row: { feature: { code: string } }) => row.feature.code as FeatureCode))

  const { activate, deactivate } = planFeatureSync(plan, active)
  if (!activate.length && !deactivate.length) return active

  const now = new Date()
  const features = await tx.feature.findMany({
    where: { code: { in: [...activate, ...deactivate] } },
    select: { id: true, code: true },
  })
  const featureId = new Map(features.map((f: { id: string; code: string }) => [f.code as FeatureCode, f.id]))

  const uncatalogued = activate.filter((code) => !featureId.has(code))
  if (uncatalogued.length)
    throw createError({
      statusCode: 500,
      message: `Feature catalog is missing ${uncatalogued.join(', ')} — cannot provision plan features`,
    })

  for (const code of activate) {
    const id = featureId.get(code)!

    await tx.clientFeature.upsert({
      where: { clientSiteId_featureId: { clientSiteId, featureId: id } },
      create: { clientSiteId, featureId: id, activatedAt: now, billingLockedUntil: now },
      update: { isActive: true, activatedAt: now, deactivatedAt: null },
    })
  }

  for (const code of deactivate) {
    const id = featureId.get(code)
    if (!id) continue

    await tx.clientFeature.updateMany({
      where: { clientSiteId, featureId: id, isActive: true },
      data: { isActive: false, deactivatedAt: now },
    })
  }

  return FEATURE_CODES.filter(
    (code) => (active.includes(code) || activate.includes(code)) && !deactivate.includes(code),
  )
}
