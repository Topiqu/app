/** Releases the page callback on unmount; options must contain only data or module-scoped defaults. */
export function useArticleFeed<T, DefaultT = T>(
  key: MaybeRefOrGetter<string>,
  fetchArticles: (signal: AbortSignal) => Promise<T>,
  options: { default: () => DefaultT; lazy?: boolean; immediate?: boolean },
) {
  const request = createAsyncDataRequest(fetchArticles)
  onScopeDispose(request.dispose)
  return useAsyncData(key, request.fetch, options)
}
