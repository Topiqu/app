import { z } from 'zod'

export const externalArticleSummaryV1Select = {
  ...externalArticleSelect,
  content: false,
  imageCredit: false,
  sources: false,
  allowedComments: false,
} as const

export const externalArticleDetailV1Select = externalArticleSelect

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
    language: 'language' in rest ? rest.language : primaryLanguage,
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

/** Any status: a key that can write must be able to read back its drafts. */
export const externalOwnedArticleV1Select = {
  ...externalArticleDetailV1Select,
  status: true,
  editVersion: true,
  releaseAt: true,
} as const

export const loadOwnedArticleV1 = async (clientSiteId: string, id: string) => {
  const article = await prisma.article.findFirst({
    where: { id, clientSiteId, deletedAt: null },
    select: externalOwnedArticleV1Select,
  })
  if (!article) return null
  const { status, editVersion, releaseAt, ...rest } = article
  return {
    ...serializeExternalArticleV1(rest, rest.language),
    status,
    editVersion,
    releaseAt: releaseAt?.toISOString() ?? null,
  }
}

const mediaRightsReview = z.object({ fingerprint: z.string().min(1).max(200), acknowledged: z.literal(true) })
const tagSlugs = z.array(z.string().trim().min(1).max(64)).max(30)
const articleFields = {
  title: z.string().trim().min(1).max(255),
  content: z.string().max(500_000),
  excerpt: z.string().max(1000).nullable(),
  slug: z.string().trim().min(1).max(100),
  tags: tagSlugs,
  status: z.enum(['draft', 'published']),
  releaseAt: z.iso.datetime({ offset: true }).nullable(),
  allowedComments: z.boolean(),
  mediaRightsReview,
}

export const apiArticleCreateSchema = z
  .object({
    ...articleFields,
    content: articleFields.content.default(''),
    status: articleFields.status.default('draft'),
    language: z.enum(LANGUAGE_OPTIONS),
  })
  .partial({ excerpt: true, slug: true, tags: true, releaseAt: true, allowedComments: true, mediaRightsReview: true })
  .partial({ language: true })
  .strict()

export const apiArticleUpdateSchema = z
  .object({ ...articleFields, expectedVersion: z.number().int().nonnegative() })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).some((key) => key !== 'expectedVersion' && key !== 'mediaRightsReview'), {
    message: 'Nothing to update',
  })

export const apiGenerationSchema = z
  .object({ topic: z.string().trim().min(3).max(500), instructions: z.string().trim().max(2000).optional() })
  .strict()

/** Publishing, unpublishing and scheduling need the PUBLISH scope; creating or editing a draft only WRITE. */
export const requiresPublishScope = (body: { status?: string; releaseAt?: string | null }, update: boolean) =>
  update
    ? body.status !== undefined || body.releaseAt !== undefined
    : body.status === 'published' || Boolean(body.releaseAt)

export const requirePublishScope = (key: AuthenticatedApiKey) => {
  if (!key.scopes.includes('PUBLISH'))
    throw createError({ statusCode: 403, message: 'API key lacks the PUBLISH scope' })
}

export const resolveTagSlugs = async (clientSiteId: string, slugs: string[] | undefined) => {
  if (!slugs) return undefined
  const unique = [...new Set(slugs)]
  const tags = await prisma.tag.findMany({
    where: { clientSiteId, slug: { in: unique } },
    select: { id: true, slug: true },
  })
  const missing = unique.filter((slug) => !tags.some((tag) => tag.slug === slug))
  if (missing.length) throw createError({ statusCode: 400, message: `Unknown tags: ${missing.join(', ')}` })
  return tags.map((tag) => tag.id)
}
