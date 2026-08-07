import {
  isTranslationDirty,
  resolveActiveLanguage,
  translationDraft,
  translationHasBody,
  countAwaitingReview,
  type ArticleTranslationRow,
} from '~~/shared/utils/articleTranslations'

export interface ArticleTranslationsPayload {
  translations: ArticleTranslationRow[]
  targetLanguages: string[]
  translationMode: 'OFF' | 'MANUAL' | 'AUTO' | 'HYBRID'
}

/**
 * Owns the "language is a dimension of the article" state for the editor: which language is
 * being edited, its draft, and the four actions that act on it. `activeLang === ''` selects
 * the source article, so the page can branch on one flag instead of tracking two ideas of
 * "current language". `articleId` is optional for `/new`, where there is nothing to translate.
 * `initialLang` seeds the tab (the admin table deep-links with `?lang=`).
 */
export const useArticleTranslations = (articleId?: string, initialLang = '') => {
  const toast = useToast()
  const { t } = useI18n()

  const { data, refresh, status } = useFetch<ArticleTranslationsPayload>(`/api/articles/${articleId}/translations`, {
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

  /** Whether this site translates at all — no tabs render without a target. */
  const enabled = computed(() => targetLanguages.value.length > 0)

  const activeLang = shallowRef(initialLang)
  const isSource = computed(() => !activeLang.value)
  const active = computed(() => (activeLang.value ? byLanguage.value[activeLang.value] : undefined))

  /**
   * Drop back to the source if the selected language stops being a configured target — but only
   * once the payload is in. An empty `targetLanguages` means both "this site has no targets" and
   * "not fetched yet", and reconciling against the second silently discarded a `?lang=` deep link
   * before the request resolved.
   */
  watchEffect(() => {
    if (status.value !== 'success' || !activeLang.value) return
    activeLang.value = resolveActiveLanguage(translations.value, targetLanguages.value, activeLang.value)
  })

  const draft = ref(translationDraft())
  const pristine = ref(translationDraft())

  watch(
    active,
    (row) => {
      draft.value = translationDraft(row)
      pristine.value = translationDraft(row)
    },
    { immediate: true },
  )

  const hasBody = computed(() => translationHasBody(active.value))
  const isDirty = computed(() => isTranslationDirty(draft.value, pristine.value))

  const pending = shallowRef<'save' | 'publish' | 'translate' | 'discard' | null>(null)

  const run = async (kind: NonNullable<typeof pending.value>, fn: () => Promise<unknown>, successKey: string) => {
    if (pending.value) return
    pending.value = kind
    try {
      await fn()
      await refresh()
      toast.success({ message: t(successKey) })
    } catch (e: any) {
      toast.error({ message: e?.data?.message || t('common.messages.saveFailed') })
    } finally {
      pending.value = null
    }
  }

  const save = (status?: 'PUBLISHED') =>
    run(
      status ? 'publish' : 'save',
      () =>
        $fetch<unknown>(`/api/translations/${active.value!.id}`, {
          method: 'PATCH',
          body: {
            title: draft.value.title,
            excerpt: draft.value.excerpt || null,
            content: draft.value.content,
            ...(status ? { status } : {}),
          },
        }),
      status ? 'articles.translations.messages.published' : 'common.messages.saveSuccess',
    )

  const translateNow = () =>
    run(
      'translate',
      () =>
        $fetch<unknown>(`/api/articles/${articleId}/translate`, {
          method: 'POST',
          body: { language: activeLang.value },
        }),
      'articles.translations.messages.translated',
    )

  const discard = () =>
    run(
      'discard',
      () => $fetch<unknown>(`/api/translations/${active.value!.id}`, { method: 'DELETE' }),
      'articles.translations.messages.discarded',
    )

  return {
    targetLanguages,
    byLanguage,
    reviewCount,
    enabled,
    activeLang,
    isSource,
    active,
    draft,
    hasBody,
    isDirty,
    pending,
    save,
    translateNow,
    discard,
    refresh,
  }
}
