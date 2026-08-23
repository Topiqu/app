import { createHash, randomBytes } from 'node:crypto'

export const invitationToken = () => randomBytes(32).toString('base64url')
export const invitationTokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
export const invitationEmail = (email: string) => email.trim().toLowerCase()
export const invitationUrl = (event: Parameters<typeof getRequestURL>[0], token: string, language = 'en') =>
  `${getRequestURL(event).origin}/${language === 'cs' ? 'cs' : 'en'}/invitation/${encodeURIComponent(token)}`

export const getTenantInvitationProfile = async (clientSiteId: string) => {
  const tenant = await prisma.clientSite.findUniqueOrThrow({
    where: { id: clientSiteId },
    select: {
      name: true,
      language: true,
      logoUrl: true,
      description: true,
      focus: true,
      domain: true,
      users: { select: { _count: { select: { followers: true } } } },
    },
  })
  return {
    ...tenant,
    followerCount: tenant.users.reduce((sum, item) => sum + item._count.followers, 0),
  }
}
