export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'MEMBER_CONTROL')
  const id = getRouterParam(event, 'id')!
  const invitation = await prisma.tenantInvitation.findFirst({ where: { id, clientSiteId: membership.clientSiteId, acceptedAt: null, revokedAt: null }, include: { clientSite: { select: { name: true, language: true } } } })
  if (!invitation) throw createError({ statusCode: 404, message: 'Invitation not found' })
  const token = invitationToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.tenantInvitation.update({ where: { id }, data: { tokenHash: invitationTokenHash(token), expiresAt } })
  await logAction({ action: 'TENANT_INVITATION_RESENT', userId: user.id, clientSiteId: membership.clientSiteId, ip: getIp(event), metadata: { invitationId: id, email: invitation.email, expiresAt: expiresAt.toISOString() } })
  await sendEmail({ event, to: invitation.email, template: 'tenantInvitation', data: { tenantName: invitation.clientSite.name, inviterName: user.name, invitationUrl: invitationUrl(event, token, invitation.clientSite.language), expirationDays: '7' } })
  return { expiresAt }
})
