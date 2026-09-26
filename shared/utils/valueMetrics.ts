import { load } from 'cheerio'

import { writingSavings } from './savings'

/** Count the visible body text, never HTML tags, URLs or image attributes. */
export const countGeneratedWords = (content: unknown): number => {
  if (typeof content !== 'string' || !content.trim()) return 0
  const document = load(content.replace(/<\/?(?:p|h[1-6]|div|li|blockquote|section|article|br|hr)\b[^>]*>/giu, ' '))
  document('script, style').remove()
  const text = document.root().text().replace(/\s+/gu, ' ').trim()
  return text ? text.split(' ').length : 0
}

export const generatedWordsFromSnapshot = (snapshot: unknown): number => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return 0
  return countGeneratedWords((snapshot as { content?: unknown }).content)
}

export type ValueActivity = 'writing' | 'research' | 'images' | 'optimization' | 'mediaReuse'
export type ValueOutcome = 'detected' | 'accepted' | 'resolved' | 'completed'

/** Audit-log metadata for future tenant-scoped value events; detection alone is not saved work. */
export interface ValueEvent {
  activity: ValueActivity
  outcome: ValueOutcome
  quantity: number
  unit: 'words' | 'items'
}

export const contributesToValue = (outcome: ValueOutcome) => outcome !== 'detected'

export const completedWritingValue = (words: number, hourlyRateUsd?: number, wordsPerHour?: number) => {
  const savings = writingSavings(words, hourlyRateUsd, wordsPerHour)
  return {
    estimatedMinutes: savings.minutes,
    estimatedAmountUsd: savings.amountUsd,
    generatedWords: savings.words,
    hourlyRateUsd: savings.hourlyRateUsd,
    wordsPerHour: savings.wordsPerHour,
    breakdown:
      savings.words > 0
        ? [{ activity: 'writing' as ValueActivity, words: savings.words, minutes: savings.minutes }]
        : [],
  }
}

/** Legacy article words are an alternative estimate, never additive to documented generation. */
export const selectWritingEstimate = (
  documented: ReturnType<typeof completedWritingValue>,
  legacy: ReturnType<typeof completedWritingValue>,
  isAllTime: boolean,
) => {
  if (documented.generatedWords > 0) return { value: documented, basis: 'documented' as const }
  if (isAllTime && legacy.generatedWords > 0) return { value: legacy, basis: 'legacy' as const }
  return { value: null, basis: 'none' as const }
}
