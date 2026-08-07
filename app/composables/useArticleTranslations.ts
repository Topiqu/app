import { countAwaitingReview, type ArticleTranslationRow } from '~~/shared/utils/articleTranslations'

export interface ArticleTranslationsPayload {
  translations: ArticleTranslationRow[]
  targetLanguages: string[]
  translationMode: 'OFF' | 'MANUAL' | 'AUTO' | 'HYBRID'
}

/**
 * Shared by the editor's header chip and the panel below it. Same `key` in both, so the pair
 * costs one request and a save in the panel refreshes the header badge. `articleId` is
 * optional for `/new`, where there is nothing to translate yet.
 */
export const useArticleTranslations = (articleId?: string) => {
  const { data, refresh } = useFetch<ArticleTranslationsPayload>(`/api/articles/${articleId}/translations`, {
    key: `article-translations-${articleId ?? 'none'}`,
    immediate: Boolean(articleId),
    default: (): ArticleTranslationsPayload => ({ translations: [], targetLanguages: [], translationMode: 'OFF' }),
  })

  const translations = computed(() => data.value.translations)
  const targetLanguages = computed(() => data.value.targetLanguages)

  const byLanguage = computed(
    () =>
      Object.fromEntries(translations.value.map((row) => [row.language, row])) as Record<
        string,
        ArticleTranslationRow | undefined
      >,
  )

  const reviewCount = computed(() => countAwaitingReview(translations.value))

  /** Whether this site translates at all — nothing translation-shaped renders without a target. */
  const enabled = computed(() => targetLanguages.value.length > 0)

  return { translations, targetLanguages, byLanguage, reviewCount, enabled, refresh }
}
