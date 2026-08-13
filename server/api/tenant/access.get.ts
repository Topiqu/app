export default defineEventHandler(async (event) => {
  const { membership } = await requireTenantMember(event)
  return { role: membership.role, scopes: membership.role === 'OWNER' ? [...TENANT_SCOPES] : membership.scopes }
})
