import type { MaybeRefOrGetter } from 'vue'

import { onUnmounted, shallowRef, toValue, watch } from 'vue'

export const buildImageRetryUrl = (url: string, attempt: number) => {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}topiqu_retry=${attempt}`
}

export const canCacheBustImageUrl = (url: string) => {
  if (url.startsWith('//') || url.startsWith('/api/')) return false
  if (!url.startsWith('/') && !/^https?:\/\//i.test(url) && !/^[^:]+\.(?:avif|gif|jpe?g|png|webp)(?:\?|$)/i.test(url))
    return false
  return !/[?&](?:signature|sig|token|x-amz-[^=]*|expires|auth)=/i.test(url)
}

export const useImageRetry = (
  source: MaybeRefOrGetter<string | null | undefined>,
  originalSource?: MaybeRefOrGetter<string | null | undefined>,
) => {
  const currentSrc = shallowRef<string | null>(null)
  const isRetrying = shallowRef(false)

  const maxRetries = 3
  let retryCount = 0
  let usingOriginal = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let settleTimeoutId: ReturnType<typeof setTimeout> | null = null

  const clearTimers = () => {
    if (timeoutId) clearTimeout(timeoutId)
    if (settleTimeoutId) clearTimeout(settleTimeoutId)
    timeoutId = null
    settleTimeoutId = null
  }

  watch(
    () => [toValue(source), originalSource ? toValue(originalSource) : undefined] as const,
    ([newUrl]) => {
      clearTimers()
      retryCount = 0
      usingOriginal = false
      isRetrying.value = false
      currentSrc.value = newUrl || null
    },
    { immediate: true },
  )

  const handleLoad = () => {
    isRetrying.value = false
    retryCount = 0
    clearTimers()
  }

  const handleError = () => {
    if (settleTimeoutId) clearTimeout(settleTimeoutId)
    settleTimeoutId = null
    const primaryUrl = toValue(source)
    const fallbackUrl = originalSource ? toValue(originalSource) : undefined
    const rawUrl = usingOriginal ? fallbackUrl : primaryUrl

    if (!rawUrl) {
      isRetrying.value = false
      currentSrc.value = null
      return
    }

    if (retryCount >= maxRetries) {
      if (!usingOriginal && fallbackUrl && fallbackUrl !== primaryUrl) {
        usingOriginal = true
        retryCount = 0
        currentSrc.value = fallbackUrl
        return
      }

      isRetrying.value = false
      currentSrc.value = null
      return
    }

    isRetrying.value = true
    retryCount++

    const delay = 500 * 2 ** (retryCount - 1)

    if (!canCacheBustImageUrl(rawUrl)) {
      retryCount = maxRetries
      handleError()
      return
    }

    timeoutId = setTimeout(() => {
      currentSrc.value = buildImageRetryUrl(rawUrl, retryCount)
      timeoutId = null
      // Once an actual image error started the retry cycle, do not let a browser
      // that silently stalls a replacement URL leave the skeleton up forever.
      settleTimeoutId = setTimeout(handleError, 1500)
    }, delay)
  }

  onUnmounted(() => {
    clearTimers()
  })

  return {
    currentSrc,
    isRetrying,
    handleError,
    handleLoad,
  }
}
