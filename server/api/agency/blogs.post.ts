import { z } from 'zod'
import { AGENCY_BLOG_PLANS, agencySlotShortfall, isAgencyLive } from '~~/shared/utils/agencyPlan'

/** The agency owner brings a blog they own into the agency's billing and team, on a plan the slots cover. */
export default defineEventHandler(async (event) => {
  const { user, member } = await requireAgencyMember(event, { owner: true })
  const { clientSiteId, plan } = await readValidatedBody(
    event,
    z.object({ clientSiteId: z.uuid(), plan: z.enum(AGENCY_BLOG_PLANS).default('PRO') }).parse,
  )
  const accountId = member.accountId
  // Ownership through the blog's own team, so an agency can never take over someone else's blog.
  const owner = await prisma.tenantMembership.findUnique({
    where: { clientSiteId_userId: { clientSiteId, userId: user.id } },
    select: { role: true, deletedAt: true, billingAccountId: true },
  })
  if (!owner || owner.role !== 'OWNER' || owner.deletedAt || owner.billingAccountId)
    throw createError({ statusCode: 403, message: 'Blog owner required' })

  await serializableTransaction(async (tx) => {
    const site = await lockBlog(tx, clientSiteId, { live: true })
    const account = await lockBillingAccount(tx, accountId)
    if (site.billingAccountId)
      throw createError({ statusCode: 409, message: 'Already in an agency', data: { code: 'ALREADY_ATTACHED' } })
    if (site.billingProvider !== 'STRIPE')
      throw createError({ statusCode: 409, message: 'Billed through Shopify', data: { code: 'SHOPIFY_BILLING' } })
    if (site.stripeSubscriptionId)
      throw createError({
        statusCode: 409,
        message: 'Cancel the blog subscription first',
        data: { code: 'OWN_SUBSCRIPTION' },
      })
    if (!isAgencyLive(account.status))
      throw createError({ statusCode: 409, message: 'No active agency subscription', data: { code: 'NOT_SUBSCRIBED' } })
    const shortfall = agencySlotShortfall(account, [...(await agencyBlogPlans(tx, accountId)), plan])
    if (shortfall) throw createError({ statusCode: 409, message: 'No free slot', data: { code: shortfall } })
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: { billingAccountId: accountId, agencyPlan: plan, plan, paidTeamSeats: null },
    })
    await syncPlanFeatures(tx, clientSiteId)
  })
  await syncAgencyMemberships(accountId)
  await logAction({
    action: 'AGENCY_BLOG_ATTACHED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { billingAccountId: accountId, plan },
  })
  return { attached: true }
})
