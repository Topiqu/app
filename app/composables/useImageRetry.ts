export const useImageRetry = (originalUrl: MaybeRefOrGetter<string | null | undefined>) => {
  const currentSrc = shallowRef<string | null>(null)
  const isRetrying = shallowRef(false)

  const maxRetries = 10
  let retryCount = 0
  const retryDelay = shallowRef(0)
  const { start: scheduleRetry, stop: cancelRetry } = useTimeoutFn(
    () => {
      const rawUrl = toValue(originalUrl)
      if (!rawUrl) return
      const separator = rawUrl.includes('?') ? '&' : '?'
      currentSrc.value = `${rawUrl}${separator}retry=${Date.now()}`
    },
    retryDelay,
    { immediate: false },
  )

  watch(
    () => toValue(originalUrl),
    (newUrl) => {
      cancelRetry()
      retryCount = 0
      isRetrying.value = false
      currentSrc.value = newUrl || null
    },
    { immediate: true },
  )

  const handleLoad = () => {
    isRetrying.value = false
    retryCount = 0
    cancelRetry()
  }

  const handleError = () => {
    const rawUrl = toValue(originalUrl)

    if (!rawUrl || retryCount >= maxRetries) {
      isRetrying.value = false
      currentSrc.value = null
      return
    }

    isRetrying.value = true
    retryCount++

    retryDelay.value = 1000 + retryCount * 500
    scheduleRetry()
  }

  return {
    currentSrc,
    isRetrying,
    handleError,
    handleLoad,
  }
}
