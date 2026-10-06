import { htmlToText } from '~~/shared/utils/articleBlocks'

type ArticleText = {
  title?: string | null
  excerpt?: string | null
  content?: string | null
  answer?: string | null
  keyTakeaways?: unknown
  faq?: unknown
}

const FIELDS = ['title', 'excerpt', 'answer', 'keyTakeaways', 'faq'] as const

/** Whether an update changes what a reader sees. Re-saving the same text or swapping markup does not. */
export const changesReaderText = (previous: ArticleText, next: ArticleText) =>
  (next.content !== undefined && htmlToText(next.content) !== htmlToText(previous.content)) ||
  FIELDS.some(
    (field) => next[field] !== undefined && JSON.stringify(next[field] || null) !== JSON.stringify(previous[field] || null),
  )

/** `dateModified` / `lastmod`: the last text change readers saw, never a view or a status flip. */
export const articleModifiedAt = (article: {
  contentUpdatedAt: Date | null
  publishedAt: Date | null
  createdAt: Date
}) => article.contentUpdatedAt ?? article.publishedAt ?? article.createdAt
