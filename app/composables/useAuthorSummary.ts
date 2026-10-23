import type { MaybeRefOrGetter } from 'vue'
import type { PublicAuthorSummary } from '~~/shared/types/article'

const authorSummaryQuery =
  (requestFetch: ReturnType<typeof useRequestFetch>, userId: string) =>
  ({ signal }: { signal: AbortSignal }) =>
    requestFetch<PublicAuthorSummary>(`/api/users/${encodeURIComponent(userId)}/author`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    })

export const useAuthorSummary = (userId: MaybeRefOrGetter<string>, enabled = true) => {
  const requestFetch = useRequestFetch()
  return useQuery(() => {
    const id = toValue(userId)
    return {
      key: queryKeys.authors.detail(id),
      query: authorSummaryQuery(requestFetch, id),
      enabled,
      staleTime: 5 * 60 * 1000,
    }
  })
}
