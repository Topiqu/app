// What the AI-written words would have cost as human copywriting. Rate is USD, matching the
// rest of the platform's money (see MAP.md → "Rate card is USD"); the display layer converts.
// 35 sits just under every median we could source (BLS OEWS 27-3043 $36.98/h, ZipRecruiter
// copywriter $36.74/h, Glassdoor $40/h) — the number has to survive a customer checking it.
export const DEFAULT_HOURLY_RATE_USD = 35
export const DEFAULT_WORDS_PER_HOUR = 400

export interface WritingSavings {
  words: number
  hourlyRateUsd: number
  wordsPerHour: number
  minutes: number
  amountUsd: number
}

export const writingSavings = (
  words: number,
  hourlyRateUsd = DEFAULT_HOURLY_RATE_USD,
  wordsPerHour = DEFAULT_WORDS_PER_HOUR,
): WritingSavings => {
  const safeWords = Number.isFinite(words) && words > 0 ? words : 0
  const speed = wordsPerHour > 0 ? wordsPerHour : DEFAULT_WORDS_PER_HOUR
  const rate = hourlyRateUsd > 0 ? hourlyRateUsd : DEFAULT_HOURLY_RATE_USD
  const hours = safeWords / speed

  return {
    words: safeWords,
    hourlyRateUsd: rate,
    wordsPerHour: speed,
    minutes: Math.round(hours * 60),
    amountUsd: Number((hours * rate).toFixed(2)),
  }
}
