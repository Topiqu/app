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
  return await Promise.all(
    members.map(async (member) => ({
      userId: member.userId,
      type: 'SYSTEM' as const,
      message: (await getServerTranslator(member.user.language))(key, { domain }),
      link: '/settings?tab=branding',
    })),
  )
}
