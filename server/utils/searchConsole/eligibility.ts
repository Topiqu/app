export const requireSearchConsoleEligibility = async (clientSiteId: string) => {
  const site = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: {
      domain: true,
      plan: true,
      deletedAt: true,
      features: { where: { isActive: true, feature: { code: 'SEARCH_CONSOLE' } }, select: { id: true }, take: 1 },
    },
  })
  if (!site || site.deletedAt || !['PREMIUM', 'CUSTOM'].includes(site.plan) || !site.features.length)
    throw createError({ statusCode: 403, message: 'Search Console intelligence requires PREMIUM' })
  return site
}
