export interface BunShutdownServer {
  stop(closeActiveConnections?: boolean): Promise<void>
}

export const bunShutdownTimeout = (value: string | undefined) => {
  if (value === undefined) return 8000
  const timeout = Number(value)
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 300_000)
    throw new Error('NITRO_SHUTDOWN_TIMEOUT must be an integer from 1 to 300000 milliseconds')
  return timeout
}

export async function settleBunCloseHooks(hooks: (() => unknown)[]) {
  const results = await Promise.allSettled(hooks.map((hook) => Promise.resolve().then(hook)))
  const failures = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []))
  if (failures.length) throw new AggregateError(failures, 'Nitro close hook failure')
}

/** Owns only lifecycle work; request bodies/events are never retained here. */
export function createBunLifecycle(options: {
  timeoutMs: number
  close: () => Promise<void>
  report: (message: string, error: unknown) => void
  exit: (code: 0 | 1) => void
}) {
  let stopping = false
  let shutdownPromise: Promise<void> | undefined
  let failed = false
  const active = new Set<Promise<void>>()
  const schedules = new Set<{ stop(): void }>()
  const report = (message: string, error: unknown, shutdownFailure = true) => {
    if (shutdownFailure) failed = true
    try {
      options.report(message, error)
    } catch {
      /* Reporting cannot prevent resource cleanup. */
    }
  }
  const track = (work: Promise<unknown>) => {
    const tracked = work
      .then(
        () => {},
        (error) => report('Background work failed', error, stopping),
      )
      .finally(() => active.delete(tracked))
    active.add(tracked)
    return tracked
  }
  return {
    get stopping() {
      return stopping
    },
    track,
    run(work: () => Promise<unknown>) {
      if (stopping) return Promise.resolve()
      return track(Promise.resolve().then(() => (stopping ? undefined : work())))
    },
    addSchedule(schedule: { stop(): void }) {
      if (stopping) schedule.stop()
      else schedules.add(schedule)
    },
    shutdown(server: BunShutdownServer) {
      if (shutdownPromise) return shutdownPromise
      stopping = true
      for (const schedule of schedules) {
        try {
          schedule.stop()
        } catch (error) {
          report('Schedule stop failed', error)
        }
      }
      schedules.clear()
      shutdownPromise = (async () => {
        let timedOut = false
        let timer: ReturnType<typeof setTimeout> | undefined
        const deadline = new Promise<'deadline'>((done) => {
          timer = setTimeout(() => {
            timedOut = true
            done('deadline')
          }, options.timeoutMs)
        })
        const forceStop = () => {
          try {
            void server.stop(true).catch((error) => report('Forced HTTP stop failed', error))
          } catch (error) {
            report('Forced HTTP stop failed', error)
          }
        }
        const drain = (async () => {
          try {
            await server.stop(false)
          } catch (error) {
            report('HTTP drain failed', error)
            forceStop()
            // Failed draining cannot establish that requests have released the DB/cache.
            return 'failed' as const
          }
          // In-flight responses may register waitUntil work; collect it after HTTP has drained.
          while (active.size && !timedOut) await Promise.all([...active])
          if (!timedOut) {
            try {
              await options.close()
            } catch (error) {
              report('Nitro close hooks failed', error)
            }
          }
          return 'drained' as const
        })()
        const result = await Promise.race([drain, deadline])
        clearTimeout(timer)
        if (result === 'deadline') {
          report('Graceful shutdown deadline exceeded', new Error('Shutdown deadline exceeded'))
          forceStop()
          options.exit(1)
          return
        }
        options.exit(failed ? 1 : 0)
      })()
      return shutdownPromise
    },
  }
}
