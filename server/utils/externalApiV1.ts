const externalArticleV1Select = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  imageUrl: true,
  imageCredit: true,
  aiInvolvement: true,
  readingTime: true,
  totalWords: true,
  sources: true,
  allowedComments: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  articleSeries: { select: { id: true, name: true, slug: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
  user: { select: { id: true, username: true, avatarUrl: true } },
  translations: {
    where: { status: 'PUBLISHED' as const },
    select: { id: true, language: true, slug: true, title: true, excerpt: true, translatedAt: true },
    orderBy: { language: 'asc' as const },
  },
} as const

export const externalArticleSummaryV1Select = {
  ...externalArticleV1Select,
  content: false,
  imageCredit: false,
  sources: false,
  allowedComments: false,
} as const

export const externalArticleDetailV1Select = externalArticleV1Select

type ExternalArticleV1 = {
  createdAt: Date
  updatedAt: Date | null
  publishedAt: Date | null
  tags: { tag: unknown }[]
  translations: ({ translatedAt: Date | null } & Record<string, unknown>)[]
} & Record<string, unknown>

export const serializeExternalArticleV1 = <T extends ExternalArticleV1>(article: T, primaryLanguage: string) => {
  const { tags, translations, createdAt, updatedAt, publishedAt, ...rest } = article

  return {
    ...rest,
    language: primaryLanguage,
    createdAt: createdAt.toISOString(),
    updatedAt: (updatedAt ?? createdAt).toISOString(),
    publishedAt: publishedAt?.toISOString() ?? null,
    tags: tags.map(({ tag }) => tag),
    availableTranslations: translations.map(({ translatedAt, ...translation }) => ({
      ...translation,
      translatedAt: translatedAt?.toISOString() ?? null,
    })),
  }
}
