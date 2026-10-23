export type MediaRightsState = 'loading' | 'analyzing' | 'complete' | 'error'

export const useMediaRights = (input: ComputedRef<ArticleMediaInput>) => {
  const state = shallowRef<MediaRightsState>('loading')
  const result = shallowRef<MediaRightsReport | null>(null)
  let requestVersion = 0
  let controller: AbortController | undefined
  let disposed = false

  const invalidate = () => {
    requestVersion++
    controller?.abort()
    controller = undefined
  }

  const analyze = async () => {
    if (disposed) return
    debouncedAnalyze.cancel()
    invalidate()
    const version = requestVersion
    const snapshot = { ...input.value }
    controller = new AbortController()
    state.value = result.value ? 'analyzing' : 'loading'
    try {
      const report = await $fetch<MediaRightsReport, '/api/media/rights-check'>('/api/media/rights-check', {
        method: 'POST',
        body: snapshot,
        signal: controller.signal,
      })
      if (version !== requestVersion) return
      result.value = report
      state.value = 'complete'
    } catch {
      if (version === requestVersion) state.value = 'error'
    } finally {
      if (version === requestVersion) controller = undefined
    }
  }
  const debouncedAnalyze = useDebounceFn(analyze, 500)

  onMounted(analyze)
  watch(
    input,
    () => {
      invalidate()
      state.value = result.value ? 'analyzing' : 'loading'
      debouncedAnalyze()
    },
    { deep: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    disposed = true
    debouncedAnalyze.cancel()
    invalidate()
  })
  return { state, result, refresh: analyze }
}
