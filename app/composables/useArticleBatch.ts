const KNOWN_ERROR_CODES = ['ACTIVE', 'NO_CREDITS', 'NO_PROFILE', 'NO_WEB_PUBLISHING', 'EMPTY', 'INSUFFICIENT_CREDITS']

/** The overview, the proposal and the progress share one request. */
export const useArticleBatchOverview = () => {
  const requestFetch = useRequestFetch()
  return useQuery({
    key: () => queryKeys.articleBatch.overview,
    // Typed by hand: inferring it from the route table exceeds TypeScript's depth limit.
    query: () => requestFetch<ArticleBatchOverview>('/api/article-batches'),
  })
}

/** The routes answer with a code; the sentence belongs to the reader's language. */
export const articleBatchErrorKey = (error: unknown) => {
  const code = (error as { data?: { data?: { code?: string } } } | null)?.data?.data?.code
  return `articleBatch.errors.${code && KNOWN_ERROR_CODES.includes(code) ? code : 'generic'}`
}
