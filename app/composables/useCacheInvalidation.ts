import { useQueryCache } from '@pinia/colada'

export const useCacheInvalidation = () => {
  const queryCache = useQueryCache()

  const invalidateArticles = () => queryCache.invalidateQueries({ key: queryKeys.articles.all })
  const invalidateArticleLists = () => queryCache.invalidateQueries({ key: queryKeys.articles.lists })
  const invalidateArticleDetail = (articleId: string) =>
    queryCache.invalidateQueries({ key: queryKeys.articles.detail(articleId) })
  const invalidateTags = () => queryCache.invalidateQueries({ key: queryKeys.tags.all })
  const invalidateStats = () => queryCache.invalidateQueries({ key: queryKeys.stats.all })
  const invalidateArticlesAndStats = () => Promise.all([invalidateArticles(), invalidateStats()])
  const invalidateClients = () => queryCache.invalidateQueries({ key: queryKeys.clients.all })

  return {
    invalidateArticles,
    invalidateArticleLists,
    invalidateArticleDetail,
    invalidateTags,
    invalidateStats,
    invalidateArticlesAndStats,
    invalidateClients,
  }
}
