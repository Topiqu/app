type RecoverableGeneration = { id: string; recoverableSnapshot: GenerationSnapshot | null }

/** Durable recovery belongs to this document; the running generation remains owned by the store. */
export const useArticleGenerationRecovery = (options: {
  documentKey: string
  target: Readonly<Ref<string | null>>
  editedArticle: Ref<ArticleWithDetails>
  articleTags: Ref<string[]>
  ownsGeneration: Readonly<Ref<boolean>>
  generation: Pick<ReturnType<typeof useArticleGenerationStore>, 'sessionId' | 'clear'>
  onRestored?: () => Promise<unknown>
}) => {
  const restoredSessionId = shallowRef<string | null>(null)
  const { data: recoverableGeneration, refresh: refreshRecoverableGeneration } =
    useLazyFetch<RecoverableGeneration | null>('/api/articles/generations/recoverable', {
      key: `article-generation-recoverable-${options.documentKey}`,
      query: computed(() => ({ articleId: options.target.value ?? undefined })),
      server: false,
      immediate: options.target.value === 'new',
      watch: false,
      default: () => null,
    })

  const resolveSession = async (id: string, action: 'restore' | 'dismiss') => {
    await $fetch<unknown, '/api/articles/generations/:id'>(
      `/api/articles/generations/${id}` as '/api/articles/generations/:id',
      { method: 'PATCH', body: { action } },
    )
    if (recoverableGeneration.value?.id === id) recoverableGeneration.value = null
  }
  const dismissGenerationSession = (id: string) => resolveSession(id, 'dismiss')
  const dismissGeneration = async () => {
    if (recoverableGeneration.value) await dismissGenerationSession(recoverableGeneration.value.id)
  }
  const markGenerationSessionsSaved = async () => {
    const active = options.ownsGeneration.value ? options.generation.sessionId : null
    const restored = restoredSessionId.value
    const ids = new Set([active, restored].filter((id): id is string => !!id))
    await Promise.allSettled(Array.from(ids, (id) => resolveSession(id, 'restore')))
    if (restoredSessionId.value === restored) restoredSessionId.value = null
    if (active && options.ownsGeneration.value && options.generation.sessionId === active) options.generation.clear()
  }
  const restoreGeneration = async () => {
    const recovery = recoverableGeneration.value
    const snapshot = recovery?.recoverableSnapshot
    if (!snapshot) return
    const article = options.editedArticle.value
    Object.assign(article, {
      title: snapshot.title ?? article.title,
      excerpt: snapshot.perex ?? article.excerpt,
      content: snapshot.content ?? article.content,
      sources: snapshot.sources ?? article.sources,
      imageUrl: snapshot.articleImageUrl === undefined ? article.imageUrl : snapshot.articleImageUrl,
      imageCredit: snapshot.articleImageCredit === undefined ? article.imageCredit : snapshot.articleImageCredit,
      coverMediaId: snapshot.articleCoverMediaId === undefined ? article.coverMediaId : snapshot.articleCoverMediaId,
      answer: snapshot.answer === undefined ? article.answer : snapshot.answer,
      keyTakeaways: snapshot.keyTakeaways ?? article.keyTakeaways,
      faq: snapshot.faq === undefined ? article.faq : snapshot.faq,
      format: snapshot.format ?? article.format,
      aiInvolvement: 'FULL',
      totalWords: snapshot.metrics?.totalWords ?? article.totalWords,
      savedAmount: snapshot.metrics?.savedAmount ?? article.savedAmount,
      savedTimeMinutes: snapshot.metrics?.savedTimeMinutes ?? article.savedTimeMinutes,
    } satisfies Partial<ArticleWithDetails>)
    if (snapshot.tags) options.articleTags.value = snapshot.tags
    restoredSessionId.value = recovery.id
    recoverableGeneration.value = null
    await options.onRestored?.()
  }

  return {
    recoverableGeneration,
    refreshRecoverableGeneration,
    restoreGeneration,
    dismissGeneration,
    dismissGenerationSession,
    markGenerationSessionsSaved,
  }
}
