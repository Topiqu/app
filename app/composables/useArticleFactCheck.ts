import type { MaybeRefOrGetter } from 'vue'
import type { ArticleFactCheckInput, ArticleFactCheckResult } from '~~/shared/types/articleFactCheck'

import { htmlToText } from '~~/shared/utils/articleBlocks'

export type ArticleFactCheckState = 'idle' | 'running' | 'complete' | 'stale' | 'error'
export type ArticleFactCheckErrorKind =
  'invalid-request' | 'not-configured' | 'not-in-plan' | 'rate-limited' | 'service-unavailable' | 'unknown'

const ERROR_KINDS: Record<number, ArticleFactCheckErrorKind> = {
  400: 'invalid-request',
  403: 'not-in-plan',
  429: 'rate-limited',
  502: 'service-unavailable',
  503: 'service-unavailable',
  504: 'service-unavailable',
}

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
  let disposed = false
  let controller: AbortController | undefined
  onScopeDispose(() => {
    disposed = true
    controller?.abort()
  })

  const canRun = computed(() => htmlToText(toValue(input).content).length >= 20)

  watch(
    () => snapshot(toValue(input)),
    (value) => {
      if (result.value && value !== analyzedSnapshot && state.value !== 'running') state.value = 'stale'
    },
  )

  const run = async () => {
    if (disposed || !canRun.value || state.value === 'running') return
    const value = toValue(input)
    const current = { ...value, sources: [...value.sources] }
    const runSnapshot = snapshot(current)
    controller = new AbortController()
    state.value = 'running'
    failure.value = null
    errorKind.value = 'unknown'
    try {
      const report = await $fetch<ArticleFactCheckResult, '/api/articles/fact-check'>('/api/articles/fact-check', {
        method: 'POST',
        body: current,
        signal: controller.signal,
      })
      if (disposed) return
      result.value = report
      analyzedSnapshot = runSnapshot
      state.value = snapshot(toValue(input)) === runSnapshot ? 'complete' : 'stale'
    } catch (error) {
      if (disposed) return
      failure.value = error
      const { statusCode, data } = (error ?? {}) as { statusCode?: number; data?: { data?: { code?: string } } }
      errorKind.value =
        data?.data?.code === 'AI_NOT_CONFIGURED'
          ? 'not-configured'
          : (statusCode && ERROR_KINDS[statusCode]) || 'unknown'
      state.value = 'error'
    } finally {
      controller = undefined
    }
  }

  return { state, result, failure, errorKind, canRun, run }
}
