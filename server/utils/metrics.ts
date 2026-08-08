import { writingSavings } from '~~/shared/utils/savings'

export const calculateArticleMetrics = (content: string, hourlyRateUsd: number, wordsPerHour: number) => {
  const cleanText = content.replace(/[#*`_~]/g, '').replace(/\[.*?\]\(.*?\)/g, '')
  const words = cleanText.trim().split(/\s+/).filter(Boolean).length
  const savings = writingSavings(words, hourlyRateUsd, wordsPerHour)

  return {
    totalWords: words,
    readingTime: Math.ceil(words / 200),
    savedTimeMinutes: savings.minutes,
    savedAmount: savings.amountUsd,
  }
}
