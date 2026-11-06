export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantMember(event)
  const usage = await getAiAllowance(membership.clientSiteId)
  // Cost guards are internal; customers see article credits and operation counts only.
  return { ...usage, allowances: usage.allowances.filter((row) => !isInternalAiAllowance(row.kind)) }
})
