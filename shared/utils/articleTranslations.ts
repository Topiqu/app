import { cleanFaq, readFaq, type FaqEntry } from './articleFaq'
import { cleanTakeaways, hasArticleBody } from './articleEditor'

export type TranslationStatus = 'PENDING' | 'TRANSLATING' | 'READY' | 'PUBLISHED' | 'FAILED' | 'STALE' | 'SKIPPED'
export type TranslationSource = 'AI' | 'HUMAN'

export const MARKET_FIT_VERDICTS = ['TRANSLATE', 'ADAPT', 'SKIP'] as const
export type MarketFitVerdict = (typeof MARKET_FIT_VERDICTS)[number]

/** `ArticleTranslation.marketFit`. `reason` is in the source article's language, written for its editor. */
export interface MarketFit {
  verdict: MarketFitVerdict
  reason: string
  localPassages: string[]
}

export const readMarketFit = (value: unknown): MarketFit | null => {
  const fit = value as Partial<MarketFit> | null | undefined
  if (!fit || !MARKET_FIT_VERDICTS.includes(fit.verdict as MarketFitVerdict)) return null
  return {
    verdict: fit.verdict as MarketFitVerdict,
    reason: typeof fit.reason === 'string' ? fit.reason : '',
    localPassages: Array.isArray(fit.localPassages)
      ? fit.localPassages.filter((passage): passage is string => typeof passage === 'string' && !!passage.trim())
      : [],
  }
}

/** Mirrors the `select` of `GET /api/articles/:id/translations`. */
export interface ArticleTranslationRow {
  id: string
  language: string
  slug: string | null
  title: string | null
  excerpt: string | null
  content: string | null
  answer: string | null
  keyTakeaways: string[]
  faq: unknown
  status: TranslationStatus
  source: TranslationSource
  error: string | null
  marketFit?: unknown
  translatedAt: string | Date | null
  translationStartedAt?: string | Date | null
  updatedAt?: string | Date | null
}

export interface TranslationDraft {
  title: string
  excerpt: string
  content: string
  answer: string
  keyTakeaways: string[]
  faq: FaqEntry[]
}

export const translationDraft = (row?: ArticleTranslationRow | null): TranslationDraft => ({
  title: row?.title ?? '',
  excerpt: row?.excerpt ?? '',
  content: row?.content ?? '',
  answer: row?.answer ?? '',
  keyTakeaways: row?.keyTakeaways ?? [],
  faq: readFaq(row?.faq),
})

/** The edit token belongs to the row that seeded a draft, including legacy nullable tokens. */
export const translationVersion = (row?: Pick<ArticleTranslationRow, 'updatedAt'> | null): string | null => {
  if (!row?.updatedAt) return null
  const value = new Date(row.updatedAt)
  return Number.isFinite(value.getTime()) ? value.toISOString() : null
}

/** A queued/in-flight/failed translation has a row but no text — nothing to edit or save. */
export const translationHasBody = (row?: ArticleTranslationRow | null) => Boolean(row?.title && row?.content)

export const isTranslationDirty = (draft: TranslationDraft, pristine: TranslationDraft) =>
  draft.title !== pristine.title ||
  draft.excerpt !== pristine.excerpt ||
  draft.answer.trim() !== pristine.answer.trim() ||
  JSON.stringify(cleanTakeaways(draft.keyTakeaways)) !== JSON.stringify(cleanTakeaways(pristine.keyTakeaways)) ||
  JSON.stringify(cleanFaq(draft.faq)) !== JSON.stringify(cleanFaq(pristine.faq)) ||
  // Tiptap normalizes an untranslated body's empty string to an empty paragraph.
  (draft.content !== pristine.content && (hasArticleBody(draft.content) || hasArticleBody(pristine.content)))

export const countAwaitingReview = (rows: ArticleTranslationRow[]) =>
  rows.filter((row) => row.status === 'READY').length

/** Dot on a language tab. No status = no row yet, so the language is untranslated. */
export const translationStatusDot = (status?: TranslationStatus) => {
  if (status === 'PUBLISHED') return 'bg-emerald-500'
  if (status === 'READY') return 'bg-amber-500'
  if (status === 'FAILED') return 'bg-red-500'
  if (status === 'STALE') return 'bg-orange-500'
  if (status === 'SKIPPED') return 'bg-gray-500'
  if (status) return 'bg-blue-500'
  return 'bg-gray-300 dark:bg-gray-600'
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
