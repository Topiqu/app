type HeartbeatStatus = 'success' | 'fail'

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
  const startedAt = Date.now()

  try {
    const result = await run()
    await pingHeartbeat(taskName, 'success')
    // A heartbeat only says the run did not throw. A run that picked up no work looks identical
    // to a healthy one, which is how a whole day of article generation went unnoticed — so ship
    // the result itself, not just the fact that it finished.
    await logger.info(`cron:${taskName}`, {
      source: 'cron',
      task: taskName,
      durationMs: Date.now() - startedAt,
      result: (result as { result?: unknown })?.result ?? null,
    })
    return result
  } catch (error) {
    await pingHeartbeat(taskName, 'fail')
    await logger.error(`cron:${taskName} failed`, {
      source: 'cron',
      task: taskName,
      durationMs: Date.now() - startedAt,
      error: (error as Error)?.message ?? String(error),
    })
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
      return withHeartbeat(name, () => run(ctx))
    },
  })
}
