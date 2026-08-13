export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'MEMBER_CONTROL')
  const id = getRouterParam(event, 'id')!
  const invitation = await prisma.tenantInvitation.findFirst({ where: { id, clientSiteId: membership.clientSiteId, acceptedAt: null, revokedAt: null } })
  if (!invitation) throw createError({ statusCode: 404, message: 'Invitation not found' })
  const token = invitationToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.tenantInvitation.update({ where: { id }, data: { tokenHash: invitationTokenHash(token), expiresAt } })
  await logAction({ action: 'TENANT_INVITATION_RESENT', userId: user.id, clientSiteId: membership.clientSiteId, ip: getIp(event), metadata: { invitationId: id, email: invitation.email, expiresAt: expiresAt.toISOString() } })
  const tenant = await getTenantInvitationProfile(membership.clientSiteId)
  await sendEmail({ event, to: invitation.email, template: 'tenantInvitation', lang: tenant.language, data: { tenantName: tenant.name, inviterName: user.name, invitationUrl: invitationUrl(event, token, tenant.language), tenantLogoUrl: tenant.logoUrl ?? '', tenantDescription: tenant.description || tenant.focus || tenant.domain, followerCount: tenant.followerCount.toLocaleString(tenant.language), tenantDomain: tenant.domain, scopeCount: String(invitation.scopes.length), expirationDays: '7' } })
  return { expiresAt }
})
