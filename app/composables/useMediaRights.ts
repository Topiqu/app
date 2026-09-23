import type { ArticleMediaInput, MediaRightsReport } from '~~/shared/types/mediaRights'

export type MediaRightsState = 'loading' | 'analyzing' | 'complete' | 'error'

export const useMediaRights = (input: ComputedRef<ArticleMediaInput>) => {
  const state = shallowRef<MediaRightsState>('loading')
  const result = shallowRef<MediaRightsReport | null>(null)

  const analyze = async () => {
    state.value = result.value ? 'analyzing' : 'loading'
    try {
      result.value = await $fetch<MediaRightsReport>('/api/media/rights-check' as any, {
        method: 'POST',
        body: input.value,
      })
      state.value = 'complete'
    } catch {
      state.value = 'error'
    }
  }
  const debouncedAnalyze = useDebounceFn(analyze, 500)

  onMounted(analyze)
  watch(input, debouncedAnalyze, { deep: true })
  return { state, result, refresh: analyze }
}
