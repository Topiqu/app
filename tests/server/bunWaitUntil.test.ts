// @vitest-environment node
import { createHooks } from 'hookable'
import { fetchNodeRequestHandler } from 'node-mock-http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, eventHandler, toNodeListener, type H3Event } from 'h3'

import { createBunLifecycle } from '../../server/runtime/bunLifecycle'

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

// Nitro's public localFetch uses this real Node-mock transport and forwards its context in onRequest.
const transport = (handler: (event: H3Event) => Promise<string> | string) => {
  const hooks = createHooks<{ afterResponse: () => Promise<void> }>()
  hooks.hook('afterResponse', async () => {
    throw new Error('Synthetic earlier hook failure')
  })
  const laterHook = vi.fn()
  hooks.hook('afterResponse', laterHook)
  const app = createApp({
    onRequest(event) {
      const request = event.node.req as typeof event.node.req & {
        __unenv__?: { waitUntil?: (promise: Promise<unknown>) => void }
      }
      event.waitUntil = (promise) => request.__unenv__?.waitUntil?.(promise)
    },
    async onAfterResponse() {
      try {
        await hooks.callHook('afterResponse')
      } catch {
        /* Nitro reports and returns from failed response hooks. */
      }
    },
  })
  app.use(eventHandler(handler))
  const close = vi.fn().mockResolvedValue(undefined)
  const report = vi.fn()
  const exit = vi.fn()
  const lifecycle = createBunLifecycle({ timeoutMs: 8000, close, report, exit })
  const fetch = () => fetchNodeRequestHandler(toNodeListener(app), '/', { context: { waitUntil: lifecycle.track } })
  return { fetch, lifecycle, close, report, exit, laterHook }
}

afterEach(() => vi.restoreAllMocks())

describe('Bun waitUntil platform context', () => {
  it('retains response background work even when an earlier serial afterResponse hook rejects', async () => {
    const background = deferred()
    const { fetch, lifecycle, close, exit, laterHook } = transport((event) => {
      event.waitUntil(background.promise)
      return 'ok'
    })
    await expect(fetch()).resolves.toMatchObject({ status: 200 })
    expect(laterHook).not.toHaveBeenCalled()
    const shutdown = lifecycle.shutdown({ stop: async () => {} })
    await Promise.resolve()
    expect(close).not.toHaveBeenCalled()
    background.resolve()
    await shutdown
    expect(close).toHaveBeenCalledOnce()
    expect(exit).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('attaches rejection reporting before the HTTP handler and response hooks finish', async () => {
    const background = deferred()
    const handlerReady = deferred()
    const responseReady = deferred()
    const { fetch, lifecycle, report, exit } = transport(async (event) => {
      event.waitUntil(background.promise)
      handlerReady.resolve()
      await responseReady.promise
      return 'ok'
    })
    const request = fetch()
    await handlerReady.promise
    const failure = new Error('Synthetic early background failure')
    background.reject(failure)
    await Promise.resolve()
    expect(report).toHaveBeenCalledExactlyOnceWith('Background work failed', failure)
    responseReady.resolve()
    await request
    await lifecycle.shutdown({ stop: async () => {} })
    expect(exit).toHaveBeenCalledExactlyOnceWith(0)
  })
})
