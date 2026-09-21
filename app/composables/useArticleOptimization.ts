import type { MaybeRefOrGetter } from 'vue'
import type { ArticleOptimizationInput, ArticleOptimizationResult } from '~~/shared/types/articleOptimization'

import { analyzeArticleOptimization } from '~~/shared/utils/articleOptimization'

export type ArticleOptimizationState = 'loading' | 'empty' | 'stale' | 'analyzing' | 'complete' | 'error'

export const useArticleOptimization = (input: MaybeRefOrGetter<ArticleOptimizationInput>) => {
  const state = shallowRef<ArticleOptimizationState>('loading')
  const result = shallowRef<ArticleOptimizationResult | null>(null)
  const failure = shallowRef<unknown>(null)
  let mounted = false

  const analyze = () => {
    if (!mounted) return
    const current = toValue(input)
    if (
      !current.title.trim() &&
      !new DOMParser().parseFromString(current.content || '', 'text/html').body.textContent?.trim()
    ) {
      result.value = null
      state.value = 'empty'
      return
    }
    state.value = 'analyzing'
    failure.value = null
    try {
      result.value = analyzeArticleOptimization(current)
      state.value = 'complete'
    } catch (error) {
      failure.value = error
      state.value = 'error'
    }
  }

  const schedule = useDebounceFn(analyze, 700)
  watch(
    () => toValue(input),
    () => {
      if (!mounted) return
      state.value = result.value ? 'stale' : 'analyzing'
      void schedule()
    },
    { deep: true },
  )
  onMounted(() => {
    mounted = true
    analyze()
  })

  return { state, result, failure, retry: analyze }
}
