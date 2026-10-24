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
  const { invalidateArticleLists } = useCacheInvalidation()

  const { data, refresh, status, error } = useFetch<ArticleTranslationsPayload>(
    `/api/articles/${articleId}/translations`,
    {
      key: `article-translations-${articleId ?? 'none'}`,
      immediate: Boolean(articleId),
      default: (): ArticleTranslationsPayload => ({ translations: [], targetLanguages: [], translationMode: 'OFF' }),
    },
  )

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
  const pristine = shallowRef(translationDraft())
  const isDirty = computed(() => isTranslationDirty(draft.value, pristine.value))
  const hasBody = computed(
    () => translationHasBody(active.value) || (isDirty.value && !!draft.value.title && !!draft.value.content),
  )
  type PendingAction = 'save' | 'publish' | 'translate' | 'discard'
  const pendingLanguages = shallowReactive(new Map<string, PendingAction>())
  const pending = computed(
    () =>
      pendingLanguages.get(activeLang.value) ??
      (active.value?.status === 'TRANSLATING' || active.value?.translationStartedAt ? 'translate' : null),
  )
  const visibility = useDocumentVisibility()
  const { pause: pausePolling, resume: resumePolling } = useIntervalFn(
    () => {
      if (status.value !== 'pending') void refresh({ dedupe: 'defer' }).catch(() => undefined)
    },
    3000,
    { immediate: false },
  )
  watch(
    () =>
      visibility.value === 'visible' &&
      translations.value.some(
        (row) => row.translationStartedAt || row.status === 'TRANSLATING' || row.status === 'PENDING',
      ),
    (running) => (running ? resumePolling() : pausePolling()),
    { immediate: true },
  )
  const conflict = shallowRef(false)
  let disposed = false
  let viewVersion = 0
  let identity: { language: string; id: string | null; expectedUpdatedAt: string | null } | undefined

  const seed = (language: string, row?: ArticleTranslationRow) => {
    draft.value = translationDraft(row)
    pristine.value = translationDraft(row)
    identity = { language, id: row?.id ?? null, expectedUpdatedAt: translationVersion(row) }
    conflict.value = false
  }
  watch(
    [activeLang, active],
    ([language, row]) => {
      if (identity?.language !== language) {
        viewVersion++
        seed(language, row)
      } else if (!isDirty.value) seed(language, row)
      else if (identity.id !== (row?.id ?? null) || identity.expectedUpdatedAt !== translationVersion(row))
        conflict.value = true
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    disposed = true
    viewVersion++
    pendingLanguages.clear()
  })

  const patchTranslation = (translation: Partial<ArticleTranslationRow> & { id: string }) => {
    data.value = {
      ...data.value,
      translations: data.value.translations.map((row) =>
        row.id === translation.id ? { ...row, ...translation } : row,
      ),
    }
  }
  const run = async <T>(
    kind: PendingAction,
    fn: () => Promise<T>,
    committed: (result: T, current: boolean) => void,
    successKey: string,
  ) => {
    const language = activeLang.value
    if (disposed || !articleId || !language || pendingLanguages.has(language)) return
    const version = viewVersion
    const current = () => !disposed && viewVersion === version && activeLang.value === language
    pendingLanguages.set(language, kind)
    try {
      let result: T
      try {
        result = await fn()
      } catch (error: unknown) {
        if (!current()) return
        const failure = error as { data?: { code?: string; data?: { code?: string } } } | null
        const code = failure?.data?.data?.code ?? failure?.data?.code
        if (code === 'ARTICLE_EDIT_CONFLICT' || code === 'ARTICLE_VERSION_REQUIRED') conflict.value = true
        else toast.add({ color: 'error', title: fetchErrorMessage(error, t('common.messages.saveFailed')) })
        return
      }
      if (!disposed) committed(result, current())
      const refreshed = await Promise.allSettled([
        Promise.resolve().then(invalidateArticleLists),
        ...(current() ? [Promise.resolve().then(() => refresh())] : []),
      ])
      if (refreshed.some((result) => result.status === 'rejected'))
        console.warn('[ArticleTranslations] Could not refresh saved translation data.')
      if (current()) toast.add({ color: 'success', title: t(successKey), description: t(`languages.${language}`) })
    } finally {
      if (!disposed) pendingLanguages.delete(language)
    }
  }

  const save = (nextStatus?: 'PUBLISHED') => {
    const token = identity && { ...identity }
    const submitted = { ...draft.value }
    if (!submitted.title.trim() || !hasArticleBody(submitted.content)) {
      toast.add({
        color: 'error',
        title: t(!submitted.title.trim() ? 'common.messages.articleTitleRequired' : 'articles.editor.contentRequired'),
      })
      return Promise.resolve()
    }
    if (!token?.id || token.language !== activeLang.value) return Promise.resolve()
    return run(
      nextStatus ? 'publish' : 'save',
      () =>
        $fetch<{ translation: Partial<ArticleTranslationRow> & { id: string } }, '/api/translations/:id'>(
          `/api/translations/${token.id}` as '/api/translations/:id',
          {
            method: 'PATCH',
            body: {
              expectedUpdatedAt: token.expectedUpdatedAt,
              title: submitted.title,
              excerpt: submitted.excerpt || null,
              content: submitted.content,
              ...(nextStatus ? { status: nextStatus } : {}),
            },
          },
        ),
      ({ translation }, current) => {
        const persisted: TranslationDraft = {
          title: translation.title ?? submitted.title,
          excerpt: translation.excerpt ?? '',
          content: translation.content ?? submitted.content,
        }
        const unchanged = !isTranslationDirty(draft.value, submitted)
        patchTranslation(translation)
        if (!current) return
        if (unchanged) draft.value = { ...persisted }
        pristine.value = persisted
        identity = { ...token, expectedUpdatedAt: translationVersion(translation) }
        conflict.value = false
      },
      nextStatus ? 'articles.translations.messages.published' : 'common.messages.saveSuccess',
    )
  }

  const translateNow = () => {
    const token = identity && { ...identity }
    const language = activeLang.value
    const submitted = { ...draft.value }
    if (!token || token.language !== language || isDirty.value) return Promise.resolve()
    return run(
      'translate',
      () =>
        $fetch<{ translation: ArticleTranslationRow }, '/api/articles/:id/translate'>(
          `/api/articles/${articleId}/translate` as '/api/articles/:id/translate',
          {
            method: 'POST',
            body: { language, replace: !!token.id, expectedUpdatedAt: token.expectedUpdatedAt, background: true },
          },
        ),
      ({ translation }, current) => {
        const unchanged = !isTranslationDirty(draft.value, submitted)
        data.value = {
          ...data.value,
          translations: [...data.value.translations.filter((row) => row.id !== translation.id), translation],
        }
        if (!current) return
        if (unchanged) draft.value = translationDraft(translation)
        pristine.value = translationDraft(translation)
        identity = { language, id: translation.id, expectedUpdatedAt: translationVersion(translation) }
        conflict.value = false
      },
      'articles.editor.translationStarted',
    )
  }

  const discard = () => {
    const token = identity && { ...identity }
    const submitted = { ...draft.value }
    if (!token?.id || token.language !== activeLang.value) return Promise.resolve()
    return run(
      'discard',
      () =>
        $fetch<unknown, '/api/translations/:id'>(`/api/translations/${token.id}` as '/api/translations/:id', {
          method: 'DELETE',
          body: { expectedUpdatedAt: token.expectedUpdatedAt },
        }),
      (_result, current) => {
        const unchanged = !isTranslationDirty(draft.value, submitted)
        data.value = { ...data.value, translations: data.value.translations.filter((row) => row.id !== token.id) }
        if (!current) return
        if (unchanged) seed(token.language)
        else conflict.value = true
      },
      'articles.translations.messages.discarded',
    )
  }

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
    conflict,
    status,
    error,
    save,
    translateNow,
    discard,
    refresh,
  }
}
