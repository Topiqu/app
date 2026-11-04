import type { H3Event } from 'h3'

export const externalArticleSelect = {
  id: true,
  title: true,
  slug: true,
  language: true,
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

export const parseExternalTagFilter = (value: unknown): string[] => {
  if (typeof value !== 'string') return []
  return [
    ...new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ]
}

export const externalArticleWhere = (clientSiteId: string, tags: string[], now = new Date()) => ({
  ...publicArticleWhere(now),
  clientSiteId,
  ...(tags.length
    ? {
        AND: tags.map((slug) => ({
          tags: { some: { tag: { slug } } },
        })),
      }
    : {}),
})

export const flattenExternalArticle = <
  T extends {
    tags: { tag: unknown }[]
    translations: unknown[]
  },
>(
  article: T,
  primaryLanguage: string,
) => {
  const { tags, translations, ...rest } = article
  return {
    ...rest,
    language: 'language' in rest ? rest.language : primaryLanguage,
    tags: tags.map(({ tag }) => tag),
    availableTranslations: translations,
  }
}

/** Read routes: any live key with the READ scope. */
export const requireExternalClient = async (event: H3Event) => (await requireApiKey(event, 'READ')).site
