// Nuxt retains async-data options after a dialog unmounts. This callback must not
// close over the dialog setup scope (and its parent editor).
const noCachedRevisions = () => undefined

export const useArticleRevisions = (articleId: string) =>
  useFetch(`/api/articles/${articleId}/revisions` as '/api/articles/:id/revisions', {
    key: `article-revisions-${articleId}`,
    server: false,
    getCachedData: noCachedRevisions,
    $fetch: useRequestFetch(),
  })
