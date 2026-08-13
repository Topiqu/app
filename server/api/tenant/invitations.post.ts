import { z } from 'zod'

const bodySchema = z.object({ email: z.email(), scopes: z.array(z.enum(TENANT_SCOPES)).max(TENANT_SCOPES.length) })

export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'MEMBER_CONTROL')
  const body = await readValidatedBody(event, bodySchema.parse)
  const email = invitationEmail(body.email)
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    select: { id: true },
  })
  if (
    existingUser &&
    (await prisma.tenantMembership.findUnique({
      where: { clientSiteId_userId: { clientSiteId: membership.clientSiteId, userId: existingUser.id } },
    }))
  )
    throw createError({ statusCode: 409, message: 'User is already a member' })

  const token = invitationToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.$transaction(async (tx) => {
    await tx.tenantInvitation.updateMany({
      where: { clientSiteId: membership.clientSiteId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await tx.tenantInvitation.create({
      data: {
        clientSiteId: membership.clientSiteId,
        email,
        scopes: [...new Set(body.scopes)],
        tokenHash: invitationTokenHash(token),
        invitedById: user.id,
        expiresAt,
      },
    })
  })
  await logAction({
    action: 'TENANT_INVITATION_CREATED', userId: user.id, clientSiteId: membership.clientSiteId, ip: getIp(event),
    metadata: { email, scopes: body.scopes, expiresAt: expiresAt.toISOString() },
  })
  const tenant = await prisma.clientSite.findUniqueOrThrow({
    where: { id: membership.clientSiteId },
    select: { name: true, language: true },
  })
  await sendEmail({
    event,
    to: email,
    template: 'tenantInvitation',
    data: {
      tenantName: tenant.name,
      inviterName: user.name,
      invitationUrl: invitationUrl(event, token, tenant.language),
      expirationDays: '7',
    },
  })
  return { expiresAt }
})
