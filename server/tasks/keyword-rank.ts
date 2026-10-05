import { checkDueRanks } from '~~/server/utils/keywords/rank'
import { measureApplied, suggestRefresh } from '~~/server/utils/keywords/refresh'

export default defineMonitoredTask({
  meta: {
    name: 'keyword-rank',
    description: 'Check the Google position of written keyword plan topics, suggest refreshes and measure applied ones',
  },
  async run() {
    const now = new Date()
    const { readings, ...summary } = await checkDueRanks(now)
    let suggested = 0
    for (const reading of readings) {
      try {
        if (reading.articleId)
          await measureApplied(reading.articleId, reading.keyword, reading.positions.at(-1) ?? null, now)
        if (await suggestRefresh(reading, reading.positions, reading.publishedAt, now)) suggested += 1
      } catch (error) {
        // The position is recorded already; the suggestion is retried with the next reading.
        console.error('[keyword-rank] Refresh suggestion failed:', reading.id, (error as Error).message)
      }
    }
    return { result: { ...summary, suggested } }
  },
})
