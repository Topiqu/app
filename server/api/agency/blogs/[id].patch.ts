import { z } from 'zod'
import { AGENCY_BLOG_PLANS, agencySlotShortfall, isAgencyLive } from '~~/shared/utils/agencyPlan'

const schema = z
  .object({
    /** A ceiling on how many of the shared units the blog may spend per period. */
    monthlyUnitLimit: z.number().int().min(1).max(100_000).nullable().optional(),
    plan: z.enum(AGENCY_BLOG_PLANS).optional(),
  })
  .refine((body) => body.monthlyUnitLimit !== undefined || body.plan !== undefined)

export default defineEventHandler(async (event) => {
  const { user, member } = await requireAgencyMember(event, { owner: true })
  const clientSiteId = getRouterParam(event, 'id')
  if (!clientSiteId) throw createError({ statusCode: 400, message: 'Missing blog' })
  const { monthlyUnitLimit, plan } = await readValidatedBody(event, schema.parse)
  const accountId = member.accountId

  const previous = await serializableTransaction(async (tx) => {
    const site = await lockBlog(tx, clientSiteId)
    if (site.billingAccountId !== accountId) throw createError({ statusCode: 404, message: 'Blog not found' })
    if (!plan || plan === site.agencyPlan) {
      await tx.clientSite.update({ where: { id: clientSiteId }, data: { monthlyUnitLimit } })
      return null
    }
    const account = await lockBillingAccount(tx, accountId)
    const shortfall = agencySlotShortfall(account, [...(await agencyBlogPlans(tx, accountId, clientSiteId)), plan])
    if (shortfall) throw createError({ statusCode: 409, message: 'No free slot', data: { code: shortfall } })
    const effective = isAgencyLive(account.status) ? plan : 'BASIC'
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: { agencyPlan: plan, plan: effective, monthlyUnitLimit },
    })
    if (effective !== site.plan) await syncPlanFeatures(tx, clientSiteId)
    return site.agencyPlan
  })
  if (plan && previous)
    await logAction({
      action: 'AGENCY_BLOG_PLAN_CHANGED',
      userId: user.id,
      clientSiteId,
      ip: getIp(event),
      metadata: { billingAccountId: accountId, from: previous, to: plan },
    })
  return { plan: plan ?? null, monthlyUnitLimit }
})
