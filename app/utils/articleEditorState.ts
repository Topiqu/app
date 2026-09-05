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
export const articleEditorSnapshot = (article: ArticleEditorSourceState, tags: string[], seriesId?: string | null) => {
  // TipTap represents an untouched empty document as `<p></p>`, while a freshly initialized
  // article starts with an empty string. They are the same persisted value and must not make the
  // editor appear dirty before the author types anything.
  const content = !article.content || article.content === '<p></p>' ? '' : article.content

  return JSON.stringify({
    title: article.title ?? '',
    excerpt: article.excerpt ?? null,
    content,
    slug: article.slug ?? '',
    imageUrl: article.imageUrl ?? null,
    imageCredit: article.imageCredit ?? null,
    status: article.status ?? null,
    releaseAt: article.releaseAt instanceof Date ? article.releaseAt.toISOString() : (article.releaseAt ?? null),
    // The sources editor mounts with one blank input for convenience. The API strips blank rows
    // before saving, so they are presentation state rather than unsaved article data.
    sources: (article.sources ?? []).map((source) => source.trim()).filter(Boolean),
    savedAmount: article.savedAmount ?? null,
    savedTimeMinutes: article.savedTimeMinutes ?? null,
    aiInvolvement: article.aiInvolvement ?? null,
    tags: [...tags].sort(),
    seriesId: seriesId ?? null,
  })
}
