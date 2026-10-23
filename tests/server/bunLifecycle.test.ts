// @vitest-environment node
import { createHooks } from 'hookable'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { bunShutdownTimeout, createBunLifecycle, settleBunCloseHooks } from '../../server/runtime/bunLifecycle'

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const setup = () => {
  const close = vi.fn().mockResolvedValue(undefined)
  const report = vi.fn()
  const exit = vi.fn()
  const stop = vi.fn().mockResolvedValue(undefined)
  const lifecycle = createBunLifecycle({ timeoutMs: 8000, close, report, exit })
  return { lifecycle, close, report, exit, server: { stop } }
}
afterEach(() => vi.useRealTimers())

describe('native Bun lifecycle', () => {
  it('stops admission/cron immediately, drains HTTP then tasks, and closes resources exactly once', async () => {
    const { lifecycle, close, exit, server } = setup()
    const http = deferred()
    const task = deferred()
    server.stop.mockReturnValue(http.promise)
    const schedule = { stop: vi.fn() }
    lifecycle.addSchedule(schedule)
    lifecycle.track(task.promise)
    const first = lifecycle.shutdown(server)
    expect(lifecycle.shutdown(server)).toBe(first)
    expect(lifecycle.stopping).toBe(true)
    expect(schedule.stop).toHaveBeenCalledOnce()
    expect(server.stop).toHaveBeenCalledWith(false)
    const newTask = vi.fn()
    await lifecycle.run(newTask)
    expect(newTask).not.toHaveBeenCalled()
    task.resolve()
    await Promise.resolve()
    expect(close).not.toHaveBeenCalled()
    http.resolve()
    await first
    expect(close).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('waits for background work registered by a response during HTTP draining', async () => {
    const { lifecycle, close, server } = setup()
    const http = deferred()
    const tail = deferred()
    server.stop.mockReturnValue(http.promise)
    const shutdown = lifecycle.shutdown(server)
    lifecycle.track(tail.promise)
    http.resolve()
    await Promise.resolve()
    expect(close).not.toHaveBeenCalled()
    tail.resolve()
    await shutdown
    expect(close).toHaveBeenCalledOnce()
  })

  it('forces unfinished connections at one shared deadline and reports exit1 without closing DB under active work', async () => {
    vi.useFakeTimers()
    const { lifecycle, close, report, exit, server } = setup()
    const http = deferred()
    server.stop.mockImplementation((force) => (force ? Promise.resolve() : http.promise))
    const shutdown = lifecycle.shutdown(server)
    await vi.advanceTimersByTimeAsync(8000)
    await shutdown
    expect(server.stop.mock.calls).toEqual([[false], [true]])
    expect(close).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith('Graceful shutdown deadline exceeded', expect.any(Error))
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
    http.resolve()
    await Promise.resolve()
    expect(close).not.toHaveBeenCalled()
  })

  it('bounds a stalled close hook and never reports a graceful success', async () => {
    vi.useFakeTimers()
    const { lifecycle, close, exit, server } = setup()
    close.mockReturnValue(new Promise(() => {}))
    const shutdown = lifecycle.shutdown(server)
    await vi.advanceTimersByTimeAsync(8000)
    await shutdown
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('does not close shared resources when HTTP draining fails and active requests are uncertain', async () => {
    const { lifecycle, close, report, exit, server } = setup()
    server.stop.mockImplementation((force) => (force ? Promise.resolve() : Promise.reject(new Error('drain failed'))))
    await lifecycle.shutdown(server)
    expect(server.stop.mock.calls).toEqual([[false], [true]])
    expect(close).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith('HTTP drain failed', expect.any(Error))
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('does not taint a later graceful shutdown with an earlier normal-operation task failure', async () => {
    const { lifecycle, close, report, exit, server } = setup()
    report.mockImplementation(() => {
      throw new Error('reporter offline')
    })
    await lifecycle.track(Promise.reject(new Error('task failed')))
    await lifecycle.shutdown(server)
    expect(close).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('reports failure when an in-flight task rejects after shutdown has begun', async () => {
    const { lifecycle, exit, server } = setup()
    const task = deferred()
    lifecycle.track(task.promise)
    const shutdown = lifecycle.shutdown(server)
    task.reject(new Error('synthetic task failure'))
    await shutdown
    expect(exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('awaits every real Hookable closer even when another closer rejects', async () => {
    const hooks = createHooks<{ close: () => Promise<void> }>()
    const delayed = deferred()
    const completed = vi.fn()
    hooks.hook('close', async () => {
      throw new Error('synthetic close failure')
    })
    hooks.hook('close', async () => {
      await delayed.promise
      completed()
    })
    const closing = hooks.callHookWith(settleBunCloseHooks, 'close')
    await Promise.resolve()
    expect(completed).not.toHaveBeenCalled()
    delayed.resolve()
    await expect(closing).rejects.toBeInstanceOf(AggregateError)
    expect(completed).toHaveBeenCalledOnce()
  })

  it('rejects invalid deadline configuration before starting a server', () => {
    expect(bunShutdownTimeout(undefined)).toBe(8000)
    expect(bunShutdownTimeout('30000')).toBe(30000)
    for (const value of ['0', '-1', 'Infinity', '300001', '1.5', '']) expect(() => bunShutdownTimeout(value)).toThrow()
  })
})
