export interface ArticleEditorSourceState {
  title?: string | null
  excerpt?: string | null
  content?: string | null
  slug?: string | null
  imageUrl?: string | null
  imageCredit?: unknown
  status?: string | null
  releaseAt?: Date | string | null
  sources?: string[] | null
  savedAmount?: number | null
  savedTimeMinutes?: number | null
  aiInvolvement?: string | null
}

/** Only persisted editor inputs belong in the dirty check; API-derived counters and relations do not. */
export const articleEditorSnapshot = (
  article: ArticleEditorSourceState,
  tags: string[],
  seriesId?: string | null,
) =>
  JSON.stringify({
    title: article.title ?? '',
    excerpt: article.excerpt ?? null,
    content: article.content ?? '',
    slug: article.slug ?? '',
    imageUrl: article.imageUrl ?? null,
    imageCredit: article.imageCredit ?? null,
    status: article.status ?? null,
    releaseAt: article.releaseAt instanceof Date ? article.releaseAt.toISOString() : (article.releaseAt ?? null),
    sources: article.sources ?? [],
    savedAmount: article.savedAmount ?? null,
    savedTimeMinutes: article.savedTimeMinutes ?? null,
    aiInvolvement: article.aiInvolvement ?? null,
    tags: [...tags].sort(),
    seriesId: seriesId ?? null,
  })
