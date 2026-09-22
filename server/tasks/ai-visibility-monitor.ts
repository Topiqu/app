import { subDays } from 'date-fns'

const CONCURRENCY = 2

export default defineMonitoredTask({
  meta: { name: 'ai-visibility-monitor', description: 'Weekly sampled AI citation monitoring' },
  async run() {
    const prompts = await prisma.aiVisibilityPrompt.findMany({
      where: {
        active: true,
        OR: [{ lastRunAt: null }, { lastRunAt: { lte: subDays(new Date(), 6) } }],
        clientSite: { plan: { in: ['PREMIUM', 'CUSTOM'] } },
      },
      select: { id: true, clientSiteId: true },
      orderBy: [{ lastRunAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
      take: 100,
    })

    const results: Array<{ status: string }> = []
    for (let offset = 0; offset < prompts.length; offset += CONCURRENCY) {
      const chunk = prompts.slice(offset, offset + CONCURRENCY)
      const settled = await Promise.allSettled(
        chunk.map((prompt) =>
          withTokenReservation(prompt.clientSiteId, VISIBILITY_TOKEN_BUDGET, 'AI_VISIBILITY', () =>
            runVisibilityPrompt(prompt.id),
          ),
        ),
      )
      for (const result of settled) {
        results.push(result.status === 'fulfilled' ? result.value : { status: 'failed' })
      }
    }

    return {
      result: {
        prompts: prompts.length,
        succeeded: results.filter((result) => result.status === 'succeeded').length,
        failed: results.filter((result) => result.status === 'failed').length,
        skipped: results.filter((result) => result.status === 'skipped').length,
      },
    }
  },
})
