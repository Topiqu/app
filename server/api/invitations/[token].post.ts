import { z } from 'zod'
const bodySchema = z.object({ action: z.enum(['accept', 'decline']) })
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const body = await readValidatedBody(event, bodySchema.parse)
  const invitation = await prisma.tenantInvitation.findUnique({ where: { tokenHash: invitationTokenHash(token) } })
  if (!invitation) throw createError({ statusCode: 404, message: 'Invitation not found', data: { code: 'INVITATION_NOT_FOUND' } })
  if (invitation.acceptedAt) throw createError({ statusCode: 409, message: 'Invitation was already accepted', data: { code: 'INVITATION_ACCEPTED' } })
  if (invitation.revokedAt) throw createError({ statusCode: 410, message: 'Invitation was revoked', data: { code: 'INVITATION_REVOKED' } })
  if (invitation.expiresAt <= new Date()) throw createError({ statusCode: 410, message: 'Invitation expired', data: { code: 'INVITATION_EXPIRED' } })
  if (body.action === 'decline') {
    await prisma.tenantInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } })
    await logAction({ action: 'TENANT_INVITATION_DECLINED', userId: invitation.invitedById, clientSiteId: invitation.clientSiteId, ip: getIp(event), metadata: { invitationId: invitation.id, email: invitation.email, actor: 'invitation_recipient' } })
    return { accepted: false }
  }
  const user = await requireUser(event)
  if (!user.sessionId) throw createError({ statusCode: 401, message: 'Active session required' })
  if (invitationEmail(user.email) !== invitation.email)
    throw createError({ statusCode: 403, message: 'Sign in with the invited email address', data: { code: 'INVITATION_EMAIL_MISMATCH', invitedEmail: invitation.email, currentEmail: user.email } })
  await prisma.$transaction([
    prisma.tenantMembership.upsert({
      where: { clientSiteId_userId: { clientSiteId: invitation.clientSiteId, userId: user.id } },
      create: { clientSiteId: invitation.clientSiteId, userId: user.id, role: 'MEMBER', scopes: invitation.scopes },
      update: { scopes: invitation.scopes, deletedAt: null },
    }),
    prisma.tenantInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } }),
    prisma.session.update({ where: { id: user.sessionId }, data: { clientSiteId: invitation.clientSiteId } }),
  ])
  await logAction({ action: 'TENANT_INVITATION_ACCEPTED', userId: user.id, clientSiteId: invitation.clientSiteId, ip: getIp(event), metadata: { invitationId: invitation.id, scopes: invitation.scopes } })
  return { accepted: true, clientSiteId: invitation.clientSiteId }
})
