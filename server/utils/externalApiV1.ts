import { externalArticleSelect } from './externalApi'

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
