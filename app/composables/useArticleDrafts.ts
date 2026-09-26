import type { ArticleWithDetails } from '~~/types/article'
import type { ArticleDraft } from '~~/generated/zenstack/models'

import slugify from 'slugify'
import equal from 'fast-deep-equal'

export const useArticleDrafts = async (
  editedArticle: Ref<ArticleWithDetails>,
  idle: Ref<boolean>,
  options: {
    /**
     * Drafts are the recovery net for an article that does not exist yet. `POST /api/articles/draft`
     * **creates a row per call**, so leaving this on while editing a saved article buried the
     * drafts list under one duplicate per autosave tick. Required rather than defaulted, because
     * both call sites got it wrong when it was implicit.
     */
    enabled: boolean
    paused?: Readonly<Ref<boolean>>
    onDraftLoaded?: () => void
  },
) => {
  const { t } = useI18n()
  const toast = useToast()
  const { enabled } = options

  const successMessage = shallowRef('')
  const draftsOpen = shallowRef(false)
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

  const persistDraft = async (force = false) => {
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
    }

    if (
      drafts.value?.some((draft) =>
        equal({ title: draft.title, excerpt: draft.excerpt || '', content: draft.content }, currentData),
      )
    ) {
      return true
    }

    saving.value = true
    try {
      await $fetch('/api/articles/draft', {
        method: 'POST',
        body: {
          ...editedArticle.value,
          savedAmount: editedArticle.value.savedAmount,
          savedTimeMinutes: editedArticle.value.savedTimeMinutes,
          aiInvolvement: editedArticle.value.aiInvolvement,
        },
      })

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
  const saveDraft = useDebounceFn(() => persistDraft(), 8000)

  const loadDraft = (draft: ArticleDraft) => {
    Object.assign(editedArticle.value, {
      title: draft.title,
      excerpt: draft.excerpt || '',
      content: draft.content,
      imageUrl: draft.imageUrl || '',
      coverMediaId: draft.coverMediaId || null,
      slug: slugify(draft.title ?? '', { lower: true, strict: true, trim: true }),
      sources: [],
      savedAmount: 0,
      savedTimeMinutes: 0,
      aiInvolvement: 'NONE',
    })

    options.onDraftLoaded?.()
  }

  if (enabled) {
    watch(
      [
        () => editedArticle.value.title,
        () => editedArticle.value.excerpt,
        () => editedArticle.value.content,
        () => editedArticle.value.imageUrl,
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
