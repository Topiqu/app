import { z } from 'zod'
const bodySchema = z.object({ action: z.enum(['accept', 'decline']) })
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')!
  const body = await readValidatedBody(event, bodySchema.parse)
  const invitation = await prisma.tenantInvitation.findUnique({ where: { tokenHash: invitationTokenHash(token) } })
  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= new Date())
    throw createError({ statusCode: 410, message: 'Invitation is no longer valid' })
  if (body.action === 'decline') {
    await prisma.tenantInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } })
    await logAction({ action: 'TENANT_INVITATION_DECLINED', userId: invitation.invitedById, clientSiteId: invitation.clientSiteId, ip: getIp(event), metadata: { invitationId: invitation.id, email: invitation.email, actor: 'invitation_recipient' } })
    return { accepted: false }
  }
  const user = await requireUser(event)
  if (invitationEmail(user.email) !== invitation.email)
    throw createError({ statusCode: 403, message: 'Sign in with the invited email address' })
  await prisma.$transaction([
    prisma.tenantMembership.upsert({
      where: { clientSiteId_userId: { clientSiteId: invitation.clientSiteId, userId: user.id } },
      create: { clientSiteId: invitation.clientSiteId, userId: user.id, role: 'MEMBER', scopes: invitation.scopes },
      update: { scopes: invitation.scopes, deletedAt: null },
    }),
    prisma.tenantInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    prisma.user.update({ where: { id: user.id }, data: { clientSiteId: invitation.clientSiteId, role: 'admin' } }),
  ])
  await logAction({ action: 'TENANT_INVITATION_ACCEPTED', userId: user.id, clientSiteId: invitation.clientSiteId, ip: getIp(event), metadata: { invitationId: invitation.id, scopes: invitation.scopes } })
  return { accepted: true, clientSiteId: invitation.clientSiteId }
})
