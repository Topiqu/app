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

export async function withHeartbeat<T>(taskName: string, run: () => Promise<T>): Promise<T> {
  try {
    const result = await run()
    await pingHeartbeat(taskName, 'success')
    return result
  } catch (error) {
    await pingHeartbeat(taskName, 'fail')
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
