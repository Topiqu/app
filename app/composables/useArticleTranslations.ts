import { countAwaitingReview, type ArticleTranslationRow } from '~~/shared/utils/articleTranslations'

export interface ArticleTranslationsPayload {
  translations: ArticleTranslationRow[]
  targetLanguages: string[]
  translationMode: 'OFF' | 'MANUAL' | 'AUTO' | 'HYBRID'
}

/**
 * One keyed fetch of an article's translations, shared by the editor page header
 * (the jump hint + review badge) and by `Article/Translations.vue` further down the
 * page. Both callers pass the same `key`, so the pair costs a single request and a
 * save inside the panel refreshes the header badge for free.
 *
 * `articleId` is optional because the editor also runs on `/new`, where there is no
 * article to translate yet — the request is simply never made.
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
