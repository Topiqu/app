import { hasAiPlan } from '~~/shared/utils/plans'

/**
 * Gates on the plan column, not on ClientFeature rows: tenants provisioned before feature
 * provisioning existed have none, so reading those would lock out paying customers. A trial
 * passes because it sits on a real plan until `trial-expiry` drops it to BASIC.
 */
export const requireAiPlan = async (clientSiteId: string, message: string) => {
  const site = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { plan: true },
  })

  if (!site) throw createError({ statusCode: 404, message })
  if (!hasAiPlan(site.plan)) throw createError({ statusCode: 403, message })

  return site
}
