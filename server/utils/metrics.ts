export const calculateArticleMetrics = (content: string, hourlyRate: number = 1400, wordsPerHour: number = 400) => {
  const cleanText = content.replace(/[#*`_~]/g, '').replace(/\[.*?\]\(.*?\)/g, '')

  const words = cleanText.trim().split(/\s+/).filter(Boolean).length
  const speed = wordsPerHour > 0 ? wordsPerHour : 400

  return {
    totalWords: words,
    readingTime: Math.ceil(words / 200),
    savedTimeMinutes: Math.round((words / speed) * 60),
    savedAmount: Number(((words / speed) * hourlyRate).toFixed(2)),
  }
}
