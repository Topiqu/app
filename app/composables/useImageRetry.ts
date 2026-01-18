export const useImageRetry = (originalUrl: MaybeRefOrGetter<string | null | undefined>) => {
  const currentSrc = shallowRef<string | null>(null)
  const isRetrying = shallowRef(false)

  const maxRetries = 10
  let retryCount = 0
  let timeoutId: NodeJS.Timeout | null = null

  watch(
    () => toValue(originalUrl),
    (newUrl) => {
      if (timeoutId) clearTimeout(timeoutId)
      retryCount = 0
      isRetrying.value = false
      currentSrc.value = newUrl || null
    },
    { immediate: true },
  )

  const handleLoad = () => {
    isRetrying.value = false
    retryCount = 0
    if (timeoutId) clearTimeout(timeoutId)
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

    const delay = 1000 + retryCount * 500

    timeoutId = setTimeout(() => {
      const separator = rawUrl.includes('?') ? '&' : '?'
      currentSrc.value = `${rawUrl}${separator}retry=${Date.now()}`
    }, delay)
  }

  onUnmounted(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })

  return {
    currentSrc,
    isRetrying,
    handleError,
    handleLoad,
  }
}
