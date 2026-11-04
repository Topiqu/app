export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantMember(event)
  return getAiAllowance(membership.clientSiteId)
})
