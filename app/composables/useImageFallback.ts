export const useImageFallback = (
  source: MaybeRefOrGetter<string | null | undefined>,
  original?: MaybeRefOrGetter<string | null | undefined>,
) => {
  // Shared by this Nuxt app, but isolated between SSR requests.
  const failed = useState<Set<string>>('failed-image-urls', () => new Set())
  const nuxtApp = useNuxtApp()
  const usable = (url: string | null | undefined, hydrating = false) =>
    url && (hydrating || !failed.value.has(url)) ? url : null
  const currentSrc = shallowRef<string | null>(null)
  const usingOriginal = shallowRef(false)

  watch(
    () => [toValue(source), toValue(original)] as const,
    ([primary, fallback]) => {
      // A previously mounted image can fail while another async component is still hydrating.
      // Its cache must not change the latter component's initial server-rendered image.
      currentSrc.value = usable(primary, nuxtApp.isHydrating) ?? usable(fallback, nuxtApp.isHydrating)
      usingOriginal.value = !usable(primary, nuxtApp.isHydrating) && !!currentSrc.value
    },
    { immediate: true },
  )

  const handleLoad = () => {
    if (import.meta.client && currentSrc.value) failed.value.delete(currentSrc.value)
  }

  const handleError = () => {
    if (!import.meta.client || !currentSrc.value) return
    failed.value.add(currentSrc.value)
    currentSrc.value = usingOriginal.value ? null : usable(toValue(original))
    usingOriginal.value = !!currentSrc.value
  }

  return { currentSrc, usingOriginal, handleError, handleLoad }
}
