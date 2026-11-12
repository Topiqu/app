/** The blog leaves the agency: back to its own BASIC plan, its own team, and its own (DIRECT) credits. */
export default defineEventHandler(async (event) => {
  const { user, member, db } = await requireAgencyMember(event, { owner: true })
  const clientSiteId = getRouterParam(event, 'id')
  if (!clientSiteId) throw createError({ statusCode: 400, message: 'Missing blog' })
  await requireAgencyBlog(db, member.accountId, clientSiteId)
  const accountId = member.accountId

  await serializableTransaction(async (tx) => {
    const site = await lockBlog(tx, clientSiteId)
    if (site.billingAccountId !== accountId) throw createError({ statusCode: 404, message: 'Blog not found' })
    await lockBillingAccount(tx, accountId)
    await tx.clientSite.update({
      where: { id: clientSiteId },
      data: { billingAccountId: null, agencyPlan: null, monthlyUnitLimit: null, plan: 'BASIC' },
    })
    await revokeAgencyAccess(tx, accountId, { clientSiteId })
    await syncPlanFeatures(tx, clientSiteId)
  })
  await logAction({
    action: 'AGENCY_BLOG_DETACHED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { billingAccountId: accountId },
  })
  return { detached: true }
})
