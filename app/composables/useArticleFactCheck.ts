import type { MaybeRefOrGetter } from 'vue'
import type { ArticleFactCheckInput, ArticleFactCheckResult } from '~~/shared/types/articleFactCheck'

export type ArticleFactCheckState = 'idle' | 'running' | 'complete' | 'stale' | 'error'
export type ArticleFactCheckErrorKind =
  'invalid-request' | 'not-configured' | 'not-in-plan' | 'rate-limited' | 'service-unavailable' | 'unknown'

const snapshot = (input: ArticleFactCheckInput) =>
  JSON.stringify({
    title: input.title.trim(),
    excerpt: input.excerpt?.trim() ?? '',
    content: input.content,
    sources: input.sources.map((source) => source.trim()).filter(Boolean),
    language: input.language,
  })

export const useArticleFactCheck = (input: MaybeRefOrGetter<ArticleFactCheckInput>) => {
  const state = shallowRef<ArticleFactCheckState>('idle')
  const result = shallowRef<ArticleFactCheckResult | null>(null)
  const failure = shallowRef<unknown>(null)
  const errorKind = shallowRef<ArticleFactCheckErrorKind>('unknown')
  let analyzedSnapshot = ''

  const canRun = computed(() => {
    const current = toValue(input)
    const text = current.content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.length >= 20
  })

  watch(
    () => snapshot(toValue(input)),
    (value) => {
      if (result.value && value !== analyzedSnapshot && state.value !== 'running') state.value = 'stale'
    },
  )

  const run = async () => {
    if (!canRun.value || state.value === 'running') return
    const current = toValue(input)
    const runSnapshot = snapshot(current)
    state.value = 'running'
    failure.value = null
    errorKind.value = 'unknown'
    try {
      result.value = await $fetch<ArticleFactCheckResult>('/api/articles/fact-check', {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
        body: current,
      })
      analyzedSnapshot = runSnapshot
      state.value = snapshot(toValue(input)) === runSnapshot ? 'complete' : 'stale'
    } catch (error) {
      failure.value = error
      const fetchError = error as {
        statusCode?: number
        status?: number
        data?: { code?: string; statusCode?: number; data?: { code?: string } }
        response?: { status?: number; _data?: { code?: string; data?: { code?: string } } }
      }
      const status =
        fetchError.statusCode ?? fetchError.status ?? fetchError.data?.statusCode ?? fetchError.response?.status
      const code =
        fetchError.data?.code ??
        fetchError.data?.data?.code ??
        fetchError.response?._data?.code ??
        fetchError.response?._data?.data?.code
      errorKind.value =
        code === 'AI_NOT_CONFIGURED'
          ? 'not-configured'
          : status === 400
            ? 'invalid-request'
            : status === 403
              ? 'not-in-plan'
              : status === 429
                ? 'rate-limited'
                : status === 502 || status === 503 || status === 504
                  ? 'service-unavailable'
                  : 'unknown'
      state.value = 'error'
    }
  }

  return { state, result, failure, errorKind, canRun, run }
}
