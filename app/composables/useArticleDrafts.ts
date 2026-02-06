import type { ArticleWithDetails } from '~~/types/article'
import type { ArticleDraft } from '@zenstackhq/runtime/models'

import slugify from 'slugify'
import equal from 'fast-deep-equal'

export const useArticleDrafts = async (
  editedArticle: Ref<ArticleWithDetails>,
  idle: Ref<boolean>,
  options?: {
    onDraftLoaded?: () => void
  },
) => {
  const { t } = useI18n()
  const toast = useToast()

  const successMessage = shallowRef('')
  const draftsOpen = shallowRef(false)

  const {
    data: drafts,
    refresh,
    pending: loading,
  } = await useLazyFetch<ArticleDraft[]>('/api/articles/draft', {
    default: () => [],
    server: false,
  })

  const saveDraft = useDebounceFn(async () => {
    if (idle.value) return

    if (
      !editedArticle.value.title &&
      !editedArticle.value.excerpt &&
      (!editedArticle.value.content || editedArticle.value.content === '<p></p>')
    ) {
      return
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
      return
    }

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

      successMessage.value = t('common.messages.draftSaved')
      await refresh()
      setTimeout(() => (successMessage.value = ''), 8000)
    } catch {
      toast.error({ message: t('common.messages.draftSaveFailed') })
    }
  }, 8000)

  const loadDraft = (draft: ArticleDraft) => {
    Object.assign(editedArticle.value, {
      title: draft.title,
      excerpt: draft.excerpt || '',
      content: draft.content,
      imageUrl: draft.imageUrl || '',
      slug: slugify(draft.title ?? '', { lower: true, strict: true, trim: true }),
      sources: [],
      savedAmount: 0,
      savedTimeMinutes: 0,
      aiInvolvement: 'NONE',
    })

    if (options?.onDraftLoaded) {
      options.onDraftLoaded()
    }
  }

  watch(
    [
      () => editedArticle.value.title,
      () => editedArticle.value.excerpt,
      () => editedArticle.value.content,
      () => editedArticle.value.imageUrl,
    ],
    saveDraft,
  )

  return {
    drafts,
    loading,
    draftsOpen,
    successMessage,
    loadDraft,
    refreshDrafts: refresh,
  }
}
