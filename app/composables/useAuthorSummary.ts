import type { MaybeRefOrGetter } from 'vue'
import type { PublicAuthorSummary } from '~~/shared/types/article'

export const useAuthorSummary = (userId: MaybeRefOrGetter<string>, enabled = true) => {
  const requestFetch = useRequestFetch()
  return useQuery({
    key: () => queryKeys.authors.detail(toValue(userId)),
    query: () =>
      requestFetch<PublicAuthorSummary>(`/api/users/${encodeURIComponent(toValue(userId))}/author`, {
        signal: AbortSignal.timeout(8000),
      }),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}
