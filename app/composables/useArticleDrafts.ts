import type { ArticleDraft, Language } from '~~/generated/zenstack/models'

export const useArticleDrafts = (
  editedArticle: Ref<ArticleWithDetails>,
  idle: Ref<boolean>,
  options: {
    /** Recovery drafts belong to an article that has not been created yet. */
    enabled: boolean
    paused?: Readonly<Ref<boolean>>
    language: Readonly<Ref<Language>>
    onDraftLoaded?: (draft: ArticleDraft) => void
  },
) => {
  const { t } = useI18n()
  const toast = useToast()
  const { enabled } = options
  let disposed = false
  let documentVersion = 0

  const successMessage = shallowRef('')
  const draftsOpen = shallowRef(false)
  const draftId = shallowRef<string | null>(null)
  const lastSavedAt = shallowRef<Date | null>(null)
  const saving = shallowRef(false)
  const { start: clearSuccessLater } = useTimeoutFn(() => (successMessage.value = ''), 8000, { immediate: false })

  const {
    data: drafts,
    refresh,
    pending: loading,
  } = useLazyFetch<ArticleDraft[]>('/api/articles/draft', {
    default: () => [],
    server: false,
    immediate: enabled,
  })

  const writeDraft = async (force = false) => {
    if (disposed) return false
    if (!force && (idle.value || options.paused?.value)) return false
    const version = documentVersion

    if (
      !editedArticle.value.title &&
      !editedArticle.value.excerpt &&
      (!editedArticle.value.content || editedArticle.value.content === '<p></p>')
    ) {
      return false
    }

    const currentData = {
      title: editedArticle.value.title,
      excerpt: editedArticle.value.excerpt || '',
      content: editedArticle.value.content,
      imageUrl: editedArticle.value.imageUrl || null,
      coverMediaId: editedArticle.value.coverMediaId || null,
      language: options.language.value,
    }

    const matchingDraft = drafts.value?.find(
      (draft) =>
        (!draftId.value || draft.id === draftId.value) &&
        draft.title === currentData.title &&
        (draft.excerpt || '') === currentData.excerpt &&
        draft.content === currentData.content &&
        (draft.imageUrl || null) === currentData.imageUrl &&
        (draft.coverMediaId || null) === currentData.coverMediaId &&
        draft.language === currentData.language,
    )
    if (matchingDraft) {
      draftId.value = matchingDraft.id
      return true
    }

    saving.value = true
    try {
      const { draft } = await $fetch<{ draft: ArticleDraft }, '/api/articles/draft'>('/api/articles/draft', {
        method: 'POST',
        body: {
          id: draftId.value ?? undefined,
          ...currentData,
        },
      })
      if (disposed || version !== documentVersion) return true
      draftId.value = draft.id

      lastSavedAt.value = new Date()
      successMessage.value = t('common.messages.draftSaved')
      await refresh()
      clearSuccessLater()
      return true
    } catch {
      if (disposed || version !== documentVersion) return false
      toast.add({
        color: 'error',
        title: t('common.messages.draftSaveFailed'),
        description: t('common.messages.draftSaveFailedHelp'),
        duration: 10000,
      })
      return false
    } finally {
      if (!disposed) saving.value = false
    }
  }
  let pendingSave: Promise<boolean> | null = null
  const persistDraft = async (force = false) => {
    while (pendingSave) await pendingSave
    if (disposed) return false
    const currentSave = writeDraft(force)
    pendingSave = currentSave
    try {
      return await currentSave
    } finally {
      if (pendingSave === currentSave) pendingSave = null
    }
  }
  const saveDraft = useDebounceFn(() => persistDraft(), 8000)
  onScopeDispose(() => {
    disposed = true
    saveDraft.cancel()
  })

  const loadDraft = (draft: ArticleDraft) => {
    documentVersion++
    draftId.value = draft.id
    options.onDraftLoaded?.(draft)
    Object.assign(editedArticle.value, {
      title: draft.title,
      excerpt: draft.excerpt || '',
      content: draft.content,
      imageUrl: draft.imageUrl || '',
      coverMediaId: draft.coverMediaId || null,
      slug: articleSlug(draft.title ?? ''),
      sources: [],
      savedAmount: 0,
      savedTimeMinutes: 0,
      aiInvolvement: 'NONE',
    })
  }

  if (enabled) {
    watch(
      [
        () => editedArticle.value.title,
        () => editedArticle.value.excerpt,
        () => editedArticle.value.content,
        () => editedArticle.value.imageUrl,
        () => editedArticle.value.coverMediaId,
        () => options.language.value,
      ],
      saveDraft,
    )
  }

  return {
    drafts,
    loading,
    draftsOpen,
    successMessage,
    lastSavedAt,
    saving,
    saveDraftNow: () => {
      saveDraft.cancel()
      return persistDraft(true)
    },
    loadDraft,
    refreshDrafts: refresh,
  }
}
