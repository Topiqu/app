/** A recovered run must return to the document that started it. Older sessions belong to new articles. */
export const generationRecoveryMatchesArticle = (options: unknown, articleId: string) => {
  const source = options && typeof options === 'object' && 'sourceArticleId' in options ? options.sourceArticleId : null
  return articleId === 'new' ? source == null : source === articleId
}
