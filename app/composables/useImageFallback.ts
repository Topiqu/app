import type { MaybeRefOrGetter } from 'vue'

// Session-wide, so a URL that failed once is skipped on every later mount instead of flashing and failing again.
const failed = new Set<string>()

const usable = (url: string | null | undefined) => (url && !failed.has(url) ? url : null)

export const useImageFallback = (
  source: MaybeRefOrGetter<string | null | undefined>,
  original?: MaybeRefOrGetter<string | null | undefined>,
) => {
  const currentSrc = shallowRef<string | null>(null)
  const usingOriginal = shallowRef(false)

  watch(
    () => [toValue(source), toValue(original)] as const,
    ([primary, fallback]) => {
      currentSrc.value = usable(primary) ?? usable(fallback)
      usingOriginal.value = !usable(primary) && !!currentSrc.value
    },
    { immediate: true },
  )

  const handleLoad = () => {
    if (currentSrc.value) failed.delete(currentSrc.value)
  }

  const handleError = () => {
    if (!currentSrc.value) return
    failed.add(currentSrc.value)
    currentSrc.value = usingOriginal.value ? null : usable(toValue(original))
    usingOriginal.value = !!currentSrc.value
  }

  return { currentSrc, usingOriginal, handleError, handleLoad }
}
