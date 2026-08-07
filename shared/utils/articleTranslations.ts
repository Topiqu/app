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

/** A queued/in-flight/failed translation has a row but no text — nothing to edit or save. */
export const translationHasBody = (row?: ArticleTranslationRow | null) => Boolean(row?.title && row?.content)

export const isTranslationDirty = (draft: TranslationDraft, pristine: TranslationDraft) =>
  draft.title !== pristine.title || draft.excerpt !== pristine.excerpt || draft.content !== pristine.content

export const countAwaitingReview = (rows: ArticleTranslationRow[]) =>
  rows.filter((row) => row.status === 'READY').length

/** Dot on a language tab. No status = no row yet, so the language is untranslated. */
export const translationStatusDot = (status?: TranslationStatus) => {
  if (status === 'PUBLISHED') return 'bg-emerald-500'
  if (status === 'READY') return 'bg-amber-500'
  if (status === 'FAILED') return 'bg-red-500'
  if (status === 'STALE') return 'bg-orange-500'
  if (status) return 'bg-blue-500'
  return 'bg-gray-300 dark:bg-gray-600'
}

export const translationStatusBadge = (status?: TranslationStatus) => {
  if (status === 'PUBLISHED') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
  if (status === 'READY') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  if (status === 'FAILED') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  return 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-300'
}

/**
 * The READY candidate is restricted to configured targets: a leftover translation for a
 * language dropped from settings has no tab, so picking it would point the panel at nothing.
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
