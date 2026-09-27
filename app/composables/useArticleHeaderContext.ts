export interface ArticleHeaderContext {
  articleId: string
  backTo: string
  canEdit: boolean
  liked: boolean
  title: string
}

// The article page publishes these for the global Header, which lives outside the page tree.
export const useArticleHeaderContext = () =>
  useState<ArticleHeaderContext | null>('topiqu-article-header-context', () => null)

export const useArticleLikeBus = () => useEventBus<undefined>('topiqu-article-like')
