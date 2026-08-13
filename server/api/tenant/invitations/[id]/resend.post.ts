export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'MEMBER_CONTROL')
  const id = getRouterParam(event, 'id')!
  const invitation = await prisma.tenantInvitation.findFirst({ where: { id, clientSiteId: membership.clientSiteId, acceptedAt: null, revokedAt: null }, include: { clientSite: { select: { name: true } } } })
  if (!invitation) throw createError({ statusCode: 404, message: 'Invitation not found' })
  const token = invitationToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.tenantInvitation.update({ where: { id }, data: { tokenHash: invitationTokenHash(token), expiresAt } })
  await sendEmail({ event, to: invitation.email, template: 'tenantInvitation', data: { tenantName: invitation.clientSite.name, inviterName: user.name, invitationUrl: invitationUrl(event, token), expirationDays: '7' } })
  return { expiresAt }
})
