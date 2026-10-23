export const domainAdminNotifications = async (clientSiteId: string, key: string, domain: string) => {
  const members = await prisma.tenantMembership.findMany({
    where: {
      clientSiteId,
      deletedAt: null,
      user: { allowNotifs: true, deletedAt: null },
      OR: [{ role: 'OWNER' }, { scopes: { has: 'TENANT_SETTINGS' } }],
    },
    select: { userId: true, user: { select: { language: true } } },
  })
  const notifications = await Promise.all(
    members.map(async (member) => {
      const message = (await getServerTranslator(member.user.language))(key, { domain })
      if (!message) {
        await reportCaughtError('Domain notification translation missing', new Error('Missing translated message'), {
          clientSiteId,
          key,
          locale: member.user.language,
        })
        return null
      }
      return { userId: member.userId, type: 'SYSTEM' as const, message, link: '/settings?tab=branding' }
    }),
  )
  return notifications.filter((notification) => notification !== null)
}
