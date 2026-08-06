export type TranslationStatus = 'PENDING' | 'TRANSLATING' | 'READY' | 'PUBLISHED' | 'FAILED' | 'STALE'
export type TranslationSource = 'AI' | 'HUMAN'

/** Mirrors the `select` of `GET /api/articles/:id/translations`. */
export interface ArticleTranslationRow {
  id: string
  language: string
  slug: string | null
  title: string | null
  excerpt: string | null
  content: string | null
  status: TranslationStatus
  source: TranslationSource
  error: string | null
  translatedAt: string | Date | null
}

export interface TranslationDraft {
  title: string
  excerpt: string
  content: string
}

export const translationDraft = (row?: ArticleTranslationRow | null): TranslationDraft => ({
  title: row?.title ?? '',
  excerpt: row?.excerpt ?? '',
  content: row?.content ?? '',
})

/**
 * There is something to edit — and therefore something to save — only once a body exists.
 * A queued / in-flight / failed translation has a row but no text, so the editing fields
 * and the save+approve actions have nothing to act on.
 */
export const translationHasBody = (row?: ArticleTranslationRow | null) => Boolean(row?.title && row?.content)

export const isTranslationDirty = (draft: TranslationDraft, pristine: TranslationDraft) =>
  draft.title !== pristine.title || draft.excerpt !== pristine.excerpt || draft.content !== pristine.content

export const countAwaitingReview = (rows: ArticleTranslationRow[]) =>
  rows.filter((row) => row.status === 'READY').length

/**
 * Which language tab to open. Keep the author's current choice while it is still a
 * configured target, otherwise land on whatever needs a human (READY) and fall back
 * to the first target. The READY candidate is itself restricted to configured targets —
 * a leftover translation for a language that was removed from the site settings has no
 * tab to select, so selecting it would leave the panel pointing at nothing.
 */
export const resolveActiveLanguage = (
  rows: ArticleTranslationRow[],
  targetLanguages: string[],
  current?: string,
): string => {
  if (!targetLanguages.length) return ''
  if (current && targetLanguages.includes(current)) return current

  const awaiting = rows.find((row) => row.status === 'READY' && targetLanguages.includes(row.language))

  return awaiting?.language ?? targetLanguages[0]!
}
