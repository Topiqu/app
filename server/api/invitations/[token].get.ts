export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const invitation = await prisma.tenantInvitation.findUnique({
    where: { tokenHash: invitationTokenHash(token) },
    select: {
      email: true,
      scopes: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      clientSite: {
        select: { name: true, logoUrl: true, users: { select: { _count: { select: { followers: true } } } } },
      },
      invitedBy: { select: { username: true } },
    },
  })
  if (!invitation) throw createError({ statusCode: 404, message: 'Invitation not found', data: { code: 'INVITATION_NOT_FOUND' } })
  if (invitation.acceptedAt) throw createError({ statusCode: 409, message: 'Invitation was already accepted', data: { code: 'INVITATION_ACCEPTED' } })
  if (invitation.revokedAt) throw createError({ statusCode: 410, message: 'Invitation was revoked', data: { code: 'INVITATION_REVOKED' } })
  if (invitation.expiresAt <= new Date()) throw createError({ statusCode: 410, message: 'Invitation expired', data: { code: 'INVITATION_EXPIRED' } })
  return {
    tenantName: invitation.clientSite.name,
    logoUrl: invitation.clientSite.logoUrl,
    inviterName: invitation.invitedBy.username,
    followerCount: invitation.clientSite.users.reduce((sum, item) => sum + item._count.followers, 0),
    email: invitation.email,
    scopes: invitation.scopes,
    expiresAt: invitation.expiresAt,
  }
})
