import type { ArticleWithDetails } from '~~/types/article'
import type { ArticleDraft, Language } from '~~/generated/zenstack/models'

import equal from 'fast-deep-equal'
import { articleSlug } from '~~/shared/utils/articleSlug'

export const useArticleDrafts = async (
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
  } = await useLazyFetch<ArticleDraft[]>('/api/articles/draft', {
    default: () => [],
    server: false,
    immediate: enabled,
  })

  const writeDraft = async (force = false) => {
    if (!force && (idle.value || options.paused?.value)) return false

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
        equal(
          {
            title: draft.title,
            excerpt: draft.excerpt || '',
            content: draft.content,
            imageUrl: draft.imageUrl || null,
            coverMediaId: draft.coverMediaId || null,
            language: draft.language,
          },
          currentData,
        ),
    )
    if (matchingDraft) {
      draftId.value = matchingDraft.id
      return true
    }

    saving.value = true
    try {
      const { draft } = await $fetch<{ draft: ArticleDraft }>('/api/articles/draft', {
        method: 'POST',
        body: {
          id: draftId.value ?? undefined,
          ...currentData,
        },
      })
      draftId.value = draft.id

      lastSavedAt.value = new Date()
      successMessage.value = t('common.messages.draftSaved')
      await refresh()
      clearSuccessLater()
      return true
    } catch {
      toast.add({ color: 'error', title: t('common.messages.draftSaveFailed') })
      return false
    } finally {
      saving.value = false
    }
  }
  let pendingSave: Promise<boolean> | null = null
  const persistDraft = async (force = false) => {
    if (pendingSave) await pendingSave
    const currentSave = writeDraft(force)
    pendingSave = currentSave
    try {
      return await currentSave
    } finally {
      if (pendingSave === currentSave) pendingSave = null
    }
  }
  const saveDraft = useDebounceFn(() => persistDraft(), 8000)

  const loadDraft = (draft: ArticleDraft) => {
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
    saveDraftNow: () => persistDraft(true),
    loadDraft,
    refreshDrafts: refresh,
  }
}
