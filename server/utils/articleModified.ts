type ArticleText = {
  title?: string | null
  excerpt?: string | null
  content?: string | null
  answer?: string | null
  keyTakeaways?: unknown
  faq?: unknown
}

const FIELDS = ['title', 'excerpt', 'answer', 'keyTakeaways', 'faq'] as const

// An empty list reads the same as none: the editor saves an empty FAQ as `[]` over a stored `null`.
const readerValue = (value: unknown) => JSON.stringify(Array.isArray(value) && !value.length ? null : value || null)

/** Whether an update changes what a reader sees. Re-saving the same text or swapping markup does not. */
export const changesReaderText = (previous: ArticleText, next: ArticleText) =>
  (next.content !== undefined && htmlToText(next.content) !== htmlToText(previous.content)) ||
  FIELDS.some((field) => next[field] !== undefined && readerValue(next[field]) !== readerValue(previous[field]))

/** `dateModified` / `lastmod`: the last text change readers saw, never a view or a status flip. */
export const articleModifiedAt = (article: {
  contentUpdatedAt: Date | null
  publishedAt: Date | null
  createdAt: Date
}) => article.contentUpdatedAt ?? article.publishedAt ?? article.createdAt
