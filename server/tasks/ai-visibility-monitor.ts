import { subHours } from 'date-fns'
import { interleaveByTenant } from '~~/shared/utils/aiVisibility'

const CONCURRENCY = 2
// Daily runs with a weekly cadence per prompt; the hour of slack keeps a prompt from slipping a day.
const RUN_INTERVAL_HOURS = 7 * 24 - 1
const MAX_PROMPTS_PER_RUN = 300
const PLANS = ['PREMIUM', 'CUSTOM'] as const

export default defineMonitoredTask({
  meta: { name: 'ai-visibility-monitor', description: 'Daily AI citation monitoring, each prompt weekly' },
  async run() {
    const retired = await retireSilentPrompts()

    const tenants = await prisma.clientSite.findMany({
      where: { plan: { in: [...PLANS] }, deletedAt: null },
      select: { id: true, aiPromptsSeededAt: true },
    })
    let seeded = 0
    for (const tenant of tenants.filter((row) => seedDue(row.aiPromptsSeededAt))) {
      try {
        seeded += (await seedVisibilityPrompts(tenant.id)).created
      } catch (error) {
        await reportCaughtError('AI visibility prompt seeding failed', error, { clientSiteId: tenant.id })
      }
    }

    const due = await prisma.aiVisibilityPrompt.findMany({
      where: {
        active: true,
        OR: [{ lastRunAt: null }, { lastRunAt: { lte: subHours(new Date(), RUN_INTERVAL_HOURS) } }],
        clientSite: { plan: { in: [...PLANS] } },
      },
      select: { id: true, clientSiteId: true },
      orderBy: [{ lastRunAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    })
    const prompts = interleaveByTenant(due).slice(0, MAX_PROMPTS_PER_RUN)

    const results: Array<{ status: string }> = []
    for (let offset = 0; offset < prompts.length; offset += CONCURRENCY) {
      const chunk = prompts.slice(offset, offset + CONCURRENCY)
      const settled = await Promise.allSettled(chunk.map((prompt) => runVisibilityPrompt(prompt.id)))
      for (const result of settled) {
        results.push(result.status === 'fulfilled' ? result.value : { status: 'failed' })
      }
    }

    return {
      result: {
        retired,
        seeded,
        due: due.length,
        prompts: prompts.length,
        succeeded: results.filter((result) => result.status === 'succeeded').length,
        failed: results.filter((result) => result.status === 'failed').length,
        skipped: results.filter((result) => result.status === 'skipped').length,
      },
    }
  },
})
