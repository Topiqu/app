import type { BillingPlans, ClientPlan } from '@prisma/client'

export type FeatureCode = 'AI' | 'SENTIMENT' | 'ARTICLE_CRONS' | 'SEARCH_CONSOLE'

type FeatureReadDb = {
  clientFeature: {
    count: (args: any) => Promise<any>
  }
}

type FeatureSyncDb = {
  clientFeature: {
    count: (args: any) => Promise<any>
    findMany: (args: any) => Promise<any[]>
    upsert: (args: any) => Promise<unknown>
    updateMany: (args: any) => Promise<unknown>
  }
  feature: {
    findMany: (args: any) => Promise<any[]>
  }
  clientSite: {
    findUnique: (args: any) => Promise<any>
    updateMany: (args: any) => Promise<unknown>
  }
  searchConsoleConnection: {
    updateMany: (args: any) => Promise<unknown>
  }
}

export const FEATURE_CODES: FeatureCode[] = ['AI', 'SENTIMENT', 'ARTICLE_CRONS', 'SEARCH_CONSOLE']

export const FEATURE_DEPENDENCIES: Record<FeatureCode, FeatureCode[]> = {
  AI: [],
  SENTIMENT: ['AI'],
  ARTICLE_CRONS: ['AI'],
  SEARCH_CONSOLE: [],
}

export const getAllowedFeatures = (plan: ClientPlan): Record<FeatureCode, boolean> => ({
  AI: ['PRO', 'PREMIUM', 'CUSTOM'].includes(plan),
  SENTIMENT: ['PREMIUM', 'CUSTOM'].includes(plan),
  ARTICLE_CRONS: ['PRO', 'PREMIUM', 'CUSTOM'].includes(plan),
  SEARCH_CONSOLE: ['PREMIUM', 'CUSTOM'].includes(plan),
})

export const isCustomPlan = (plan: ClientPlan): boolean => plan === 'CUSTOM'

export const getMissingDependencies = (code: FeatureCode, active: FeatureCode[]): FeatureCode[] =>
  FEATURE_DEPENDENCIES[code].filter((dep) => !active.includes(dep))

export const getDependents = (code: FeatureCode): FeatureCode[] =>
  FEATURE_CODES.filter((c) => FEATURE_DEPENDENCIES[c].includes(code))

export const billableMonthlyTotal = (plan: ClientPlan, billingPlan: string, billedPrices: number[]): number =>
  isCustomPlan(plan) && billingPlan !== 'PERMANENT' ? billedPrices.reduce((sum, price) => sum + price, 0) : 0

export const annualFromMonthly = (monthly: number, billingPlan: string): number =>
  billingPlan === 'ANNUAL' ? Math.round(monthly * 12 * 0.8) : monthly * 12

/**
 * Billable while on, or still inside the 30-day lock it got when enabled. The `isActive`
 * clause is not redundant: plan-granted rows get `billingLockedUntil = now`, so matching on
 * the lock alone would hand a PREMIUM→CUSTOM tenant every inherited feature for free.
 */
export const billableFeatureWhere = (clientSiteId: string, now: Date) => ({
  clientSiteId,
  OR: [{ isActive: true }, { billingLockedUntil: { gt: now } }],
})

export const activeFeatureFilter = (code: FeatureCode) => ({
  features: { some: { isActive: true, feature: { code } } },
})

export const hasActiveFeature = async (tx: FeatureReadDb, clientSiteId: string, code: FeatureCode): Promise<boolean> =>
  (await tx.clientFeature.count({
    where: { clientSiteId, isActive: true, feature: { code } },
  })) > 0

export type PlanFeatureSync = { activate: FeatureCode[]; deactivate: FeatureCode[] }

export const planFeatureSync = (plan: ClientPlan, active: FeatureCode[]): PlanFeatureSync => {
  if (isCustomPlan(plan)) return { activate: [], deactivate: [] }

  const allowed = getAllowedFeatures(plan)

  return {
    activate: FEATURE_CODES.filter((code) => allowed[code] && !active.includes(code)),
    deactivate: FEATURE_CODES.filter((code) => !allowed[code] && active.includes(code)),
  }
}

/**
 * Turning it on costs a danger confirm, so leaving it `true` through a revocation would let
 * a later re-subscribe silently resume auto-publishing without anyone confirming again.
 */
export const syncAutoRelease = async (tx: FeatureSyncDb, clientSiteId: string, active: FeatureCode[]) => {
  if (active.includes('ARTICLE_CRONS')) return

  await tx.clientSite.updateMany({
    where: { id: clientSiteId, autoRelease: true },
    data: { autoRelease: false },
  })
}

/** The feature toggle is the client's scheduling control. Keeping a separate `NONE` value while
 *  the feature says enabled creates a configuration that can never run and cannot be repaired in
 *  client settings. Preserve an explicit DAILY/WEEKLY choice; otherwise use DAILY as the default. */
export const syncGenerationSchedule = async (tx: FeatureSyncDb, clientSiteId: string, active: FeatureCode[]) => {
  if (active.includes('ARTICLE_CRONS')) {
    await tx.clientSite.updateMany({
      where: { id: clientSiteId, generationFrequency: 'NONE' },
      data: { generationFrequency: 'DAILY' },
    })
    return
  }

  await tx.clientSite.updateMany({
    where: { id: clientSiteId, generationFrequency: { not: 'NONE' } },
    data: { generationFrequency: 'NONE' },
  })
}

/** Losing either data access or AI must require a fresh explicit autopilot opt-in later. */
export const syncSeoAutopilot = async (tx: FeatureSyncDb, clientSiteId: string, active: FeatureCode[]) => {
  if (active.includes('SEARCH_CONSOLE') && active.includes('AI')) return

  await tx.searchConsoleConnection.updateMany({
    where: { clientSiteId, autopilotEnabled: true },
    data: { autopilotEnabled: false },
  })
}

/** Re-derives the stored à-la-carte price from whatever is billable right now. */
export const recalcFeatureBilling = async (
  tx: FeatureSyncDb,
  clientSiteId: string,
  plan: ClientPlan,
  billingPlan: BillingPlans | string,
  now: Date = new Date(),
) => {
  let monthlyPayment = 0

  if (isCustomPlan(plan)) {
    const billed = await tx.clientFeature.findMany({
      where: billableFeatureWhere(clientSiteId, now),
      include: { feature: { select: { priceMonthly: true } } },
    })

    monthlyPayment = billableMonthlyTotal(
      plan,
      billingPlan,
      billed.map((cf: { feature: { priceMonthly: number } }) => cf.feature.priceMonthly),
    )
  }

  const annualPayment = annualFromMonthly(monthlyPayment, billingPlan)

  await tx.clientSite.updateMany({
    where: { id: clientSiteId },
    data: { monthlyPayment, annualPayment },
  })

  return { monthlyPayment, annualPayment }
}

/** Entry point for every plan transition: provision, revoke, then re-assert autoRelease + price. */
export const syncPlanFeatures = async (tx: FeatureSyncDb, clientSiteId: string, plan: ClientPlan) => {
  const site = await tx.clientSite.findUnique({ where: { id: clientSiteId }, select: { billingPlan: true } })
  if (!site) return []

  const active = await tx.clientFeature
    .findMany({
      where: { clientSiteId, isActive: true },
      select: { feature: { select: { code: true } } },
    })
    .then((rows) => rows.map((row: { feature: { code: string } }) => row.feature.code as FeatureCode))

  const { activate, deactivate } = planFeatureSync(plan, active)

  if (activate.length || deactivate.length) {
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
  }

  const nextActive = FEATURE_CODES.filter(
    (code) => (active.includes(code) || activate.includes(code)) && !deactivate.includes(code),
  )

  await syncAutoRelease(tx, clientSiteId, nextActive)
  await syncGenerationSchedule(tx, clientSiteId, nextActive)
  await syncSeoAutopilot(tx, clientSiteId, nextActive)
  await recalcFeatureBilling(tx, clientSiteId, plan, site.billingPlan)

  return nextActive
}
