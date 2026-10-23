import { publicArticleWhere } from '../../utils/articleViewerAccess'

export default defineEventHandler(async (event) => {
  const clientSite = await requireExternalClient(event)
  const where = { clientSiteId: clientSite.id, ...publicArticleWhere() }

  const [socials, translatedLanguages, sourceLanguages, articleCount] = await prisma.$transaction([
    prisma.social.findMany({
      where: { clientSiteId: clientSite.id },
      select: { platform: true, url: true },
      orderBy: { platform: 'asc' },
    }),
    prisma.articleTranslation.findMany({
      where: { clientSiteId: clientSite.id, status: 'PUBLISHED', article: where },
      distinct: ['language'],
      select: { language: true },
      orderBy: { language: 'asc' },
    }),
    prisma.article.findMany({
      where,
      distinct: ['language'],
      select: { language: true },
    }),
    prisma.article.count({ where }),
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
        ...new Set([
          clientSite.language,
          ...sourceLanguages.map(({ language }) => language),
          ...translatedLanguages.map(({ language }) => language),
        ]),
      ],
      socials,
      articleCount,
    },
  }
})
