import type { Language } from '~~/generated/zenstack/models'

/** Google geo target IDs, as DataForSEO takes them. */
const COUNTRIES = {
  CZ: 2203,
  DE: 2276,
  AT: 2040,
  CH: 2756,
  FR: 2250,
  BE: 2056,
  CA: 2124,
  US: 2840,
  GB: 2826,
  AU: 2036,
  IE: 2372,
} as const

export type KeywordCountry = keyof typeof COUNTRIES
export type KeywordMarket = KeywordCountry | 'GLOBAL'

/**
 * Countries where DataForSEO has data in the article language, home market first. Slovakia is missing on
 * purpose: Labs only knows Slovak there, so Czech has no second market.
 */
export const LANGUAGE_MARKETS = {
  cs: ['CZ'],
  de: ['DE', 'AT', 'CH', 'GLOBAL'],
  fr: ['FR', 'BE', 'CH', 'CA', 'GLOBAL'],
  en: ['US', 'GB', 'CA', 'AU', 'IE', 'GLOBAL'],
} as const satisfies Record<Language, readonly KeywordMarket[]>

export const keywordMarketsFor = (language: Language): readonly KeywordMarket[] => LANGUAGE_MARKETS[language]

/** An unset or no-longer-offered market falls back to the language's home market. */
export const keywordMarketFor = (language: Language, market?: string | null): KeywordMarket =>
  keywordMarketsFor(language).find((option) => option === market) ?? LANGUAGE_MARKETS[language][0]

/**
 * DataForSEO parameters for a market. Labs answers GLOBAL without a location; SERP and Google News always
 * need one, so `serpLocationCode` falls back to the home market there.
 */
export const keywordLocation = (language: Language, market?: string | null) => {
  const resolved = keywordMarketFor(language, market)
  const home = COUNTRIES[LANGUAGE_MARKETS[language][0] as KeywordCountry]
  const country = resolved === 'GLOBAL' ? null : COUNTRIES[resolved]
  return { market: resolved, languageCode: language, labsLocationCode: country, serpLocationCode: country ?? home }
}

export const KEYWORD_PLAN_EDITABLE_STATUSES = ['OPEN', 'PINNED', 'SKIPPED'] as const

/** Badge instead of a raw 0–100 score: the number suggests a precision the estimate does not have. */
export const difficultyLevel = (difficulty: number | null | undefined) =>
  difficulty == null ? null : difficulty < 30 ? 'easy' : difficulty < 60 ? 'medium' : 'hard'
