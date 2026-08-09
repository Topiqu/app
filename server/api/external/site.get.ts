export default defineEventHandler(async (event) => {
  const clientSite = await requireExternalClient(event)

  const [socials, translatedLanguages, articleCount] = await prisma.$transaction([
    prisma.social.findMany({
      where: { clientSiteId: clientSite.id },
      select: { platform: true, url: true },
      orderBy: { platform: 'asc' },
    }),
    prisma.articleTranslation.findMany({
      where: { clientSiteId: clientSite.id, status: 'PUBLISHED' },
      distinct: ['language'],
      select: { language: true },
      orderBy: { language: 'asc' },
    }),
    prisma.article.count({ where: { clientSiteId: clientSite.id, status: 'published' } }),
  ])

  return {
    data: {
      id: clientSite.id,
      name: clientSite.name,
      domain: clientSite.domain,
      description: clientSite.description,
      logoUrl: clientSite.logoUrl,
      theme: clientSite.theme,
      primaryLanguage: clientSite.language,
      availableLanguages: [
        clientSite.language,
        ...translatedLanguages.map(({ language }) => language).filter((language) => language !== clientSite.language),
      ],
      socials,
      articleCount,
    },
  }
})
