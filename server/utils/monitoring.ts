import { randomUUID } from 'node:crypto'

type HeartbeatStatus = 'success' | 'fail'

async function recordTaskStatus(write: () => Promise<unknown>): Promise<void> {
  try {
    await write()
  } catch {
    // Observability must never turn a completed customer result into a failed paid run.
    try {
      await logger.error('Cron status persistence failed', { source: 'cron-monitoring', code: 'STATUS_WRITE_FAILED' })
    } catch {
      console.error('[cron-monitoring] STATUS_WRITE_FAILED')
    }
  }
}

function heartbeatUrl(taskName: string): string | undefined {
  const key = `BETTERSTACK_HEARTBEAT_${taskName.toUpperCase().replace(/-/g, '_')}`
  return process.env[key]
}

export async function pingHeartbeat(taskName: string, status: HeartbeatStatus = 'success'): Promise<void> {
  const url = heartbeatUrl(taskName)
  if (!url) return

  try {
    await $fetch(status === 'fail' ? `${url}/fail` : url, {
      method: 'GET',
      timeout: 5000,
      retry: 1,
    })
  } catch {
    return
  }
}

export async function withHeartbeat<T>(taskName: string, run: () => T | Promise<T>): Promise<Awaited<T>> {
  const startedAt = new Date()
  const runId = randomUUID()
  await recordTaskStatus(async () => {
    await prisma.systemTaskStatus.upsert({ where: { name: taskName }, create: { name: taskName }, update: {} })
    await prisma.systemTaskStatus.updateMany({
      where: { name: taskName, OR: [{ startedAt: null }, { startedAt: { lte: startedAt } }] },
      data: {
        runId,
        startedAt,
        finishedAt: null,
        status: 'running',
        failureCode: null,
        processed: null,
        failed: null,
        skipped: null,
      },
    })
  })

  const finish = async (result: unknown, thrown: boolean) => {
    const finishedAt = new Date()
    const counts = taskResultCounts(result)
    const failed = thrown || (counts.failed ?? 0) > 0
    await recordTaskStatus(async () => {
      // An older replica's completion cannot replace a more recently started run's status.
      await prisma.systemTaskStatus.updateMany({
        where: { name: taskName, runId },
        data: {
          finishedAt,
          durationMs: Math.max(0, Math.min(finishedAt.getTime() - startedAt.getTime(), 2_147_483_647)),
          status: thrown ? 'failed' : failed ? 'degraded' : 'succeeded',
          failureCode: thrown ? 'TASK_FAILED' : failed ? 'ITEM_FAILURES' : null,
          ...counts,
        },
      })
      const field = failed ? 'lastFailedAt' : 'lastSucceededAt'
      await prisma.systemTaskStatus.updateMany({
        where: { name: taskName, OR: [{ [field]: null }, { [field]: { lt: finishedAt } }] },
        data: { [field]: finishedAt },
      })
    })
    return { counts, failed, durationMs: finishedAt.getTime() - startedAt.getTime() }
  }

  try {
    const result = await run()
    const status = await finish(result, false)
    await pingHeartbeat(taskName, status.failed ? 'fail' : 'success')
    await logger
      .info(`cron:${taskName}`, {
        source: 'cron',
        task: taskName,
        durationMs: status.durationMs,
        result: status.counts,
      })
      .catch(() => {})
    return result
  } catch (error) {
    const status = await finish(null, true)
    await pingHeartbeat(taskName, 'fail')
    await logger
      .error(`cron:${taskName} failed`, {
        source: 'cron',
        task: taskName,
        durationMs: status.durationMs,
        code: 'TASK_FAILED',
      })
      .catch(() => {})
    throw error
  }
}

/**
 * Drop-in replacement for `defineTask` that pings the matching Better Stack
 * heartbeat (`BETTERSTACK_HEARTBEAT_<NAME>`) on every run — success or fail.
 * Wrapping at task level covers both the Nitro-scheduled path and manual
 * `runTask()` cron routes. No-ops when the heartbeat env var is unset.
 */
export function defineMonitoredTask(def: Parameters<typeof defineTask>[0]): ReturnType<typeof defineTask> {
  const name = def.meta?.name
  const run = def.run
  return defineTask({
    ...def,
    async run(ctx) {
      if (!name || !run) return run?.(ctx)
      return withHeartbeat(name, () => Promise.resolve(run(ctx)))
    },
  })
}
