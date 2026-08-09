import type { H3Event } from 'h3'

export const externalArticleSelect = {
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

export const externalArticleWhere = (clientSiteId: string, tags: string[]) => ({
  clientSiteId,
  status: 'published' as const,
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
    language: primaryLanguage,
    tags: tags.map(({ tag }) => tag),
    availableTranslations: translations,
  }
}

export const requireExternalClient = async (event: H3Event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'Vary', 'x-api-key')

  const apiKey = getHeader(event, 'x-api-key')?.trim()

  if (!apiKey) throw createError({ statusCode: 401, message: 'Missing API Key' })

  const clientSite = await prisma.clientSite.findFirst({
    where: { apiKey, deletedAt: null },
    select: {
      id: true,
      name: true,
      domain: true,
      description: true,
      logoUrl: true,
      language: true,
      theme: true,
    },
  })

  if (!clientSite) throw createError({ statusCode: 401, message: 'Invalid API Key' })
  return clientSite
}
