import { TranslationStatus } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const { skip, take } = await getPagination(event)
  const { status } = await getValidatedQuery(
    event,
    z
      .object({ status: z.nativeEnum(TranslationStatus).optional() })
      .partial()
      .passthrough().parse,
  )

  const where = { clientSiteId: user.clientSiteId!, status: status ?? TranslationStatus.READY }

  const [translations, total] = await Promise.all([
    db.articleTranslation.findMany({
      where,
      take: take + 1,
      skip,
      orderBy: { translatedAt: 'desc' },
      select: {
        id: true,
        language: true,
        slug: true,
        title: true,
        excerpt: true,
        status: true,
        source: true,
        translatedAt: true,
        article: { select: { id: true, slug: true, title: true } },
      },
    }),
    db.articleTranslation.count({ where }),
  ])

  const hasMore = translations.length > take

  return { translations: hasMore ? translations.slice(0, take) : translations, hasMore, total }
})
