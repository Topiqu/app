import { createError, createEvent, type H3Event } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
type Hooks = {
  request: (event: H3Event) => void
  error: (error: Error, context: { event?: H3Event }) => Promise<void>
  afterResponse: (event: H3Event) => Promise<void>
}
let hooks: Hooks
const setupEvent = (method = 'GET', statusCode = 200) => {
  const headers = new Map<string, unknown>()
  return createEvent(
    {
      url: '/api/notifications/poll?token=private',
      method,
      headers: {
        host: 'internal:3000',
        'x-forwarded-host': 'blog.example.test',
        'x-forwarded-proto': 'https',
        cookie: 'secret',
      },
    } as never,
    {
      statusCode,
      getHeader: (key: string) => headers.get(key),
      setHeader: (key: string, value: unknown) => headers.set(key, value),
    } as never,
  )
}
beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('logger', log)
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
  const plugin = (await import('../../server/plugins/errorLogging')).default
  hooks = {} as Hooks
  plugin({
    hooks: {
      hook: (name: keyof Hooks, callback: Hooks[keyof Hooks]) => {
        Object.assign(hooks, { [name]: callback })
      },
    },
  } as never)
})
afterEach(() => vi.unstubAllGlobals())

describe('Nitro error logging', () => {
  it('logs a denied request once with the host, request id and explicit reason, excluding cookies and query strings', async () => {
    const event = setupEvent('GET', 403)
    hooks.request(event)
    await hooks.error(createError({ statusCode: 403, data: { code: 'AUTH_HOST_UNAVAILABLE' } }), { event })
    await hooks.afterResponse(event)
    expect(log.warn).toHaveBeenCalledOnce()
    expect(log.warn.mock.calls[0]![1]).toMatchObject({
      path: '/api/notifications/poll',
      host: 'blog.example.test',
      protocol: 'https',
      statusCode: 403,
      reason: 'AUTH_HOST_UNAVAILABLE',
      requestId: expect.any(String),
      durationMs: expect.any(Number),
      error: { message: 'Forbidden' },
    })
    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/private|cookie|internal:3000/)
  })

  it('records returned failures even when no exception was thrown', async () => {
    const event = setupEvent('GET', 503)
    hooks.request(event)
    await hooks.afterResponse(event)
    expect(log.error).toHaveBeenCalledOnce()
    expect(log.error.mock.calls[0]![1]).toMatchObject({ reason: 'HTTP_503' })
  })

  it.each([400, 401, 403, 404, 429])('omits stack traces for expected HTTP %i failures', async (statusCode) => {
    const event = setupEvent('POST', statusCode)
    hooks.request(event)
    await hooks.error(
      createError({ statusCode, message: 'Request rejected', cause: new Error('Expected rejection') }),
      { event },
    )
    const context = (log.info.mock.calls[0] ?? log.warn.mock.calls[0])![1]
    expect(context.error).toMatchObject({ message: 'Request rejected', cause: { message: 'Expected rejection' } })
    expect(JSON.stringify(context.error)).not.toContain('stack')
  })

  it('retains diagnostic stacks for unexpected server failures', async () => {
    const event = setupEvent('POST', 500)
    await hooks.error(
      createError({ statusCode: 500, message: 'Database unavailable', cause: new Error('Connection refused') }),
      { event },
    )
    expect(log.error.mock.calls[0]![1].error).toMatchObject({
      message: 'Database unavailable',
      stack: expect.any(String),
      cause: { message: 'Connection refused', stack: expect.any(String) },
    })
  })

  it('keeps successful reads at debug level and mutations at info level', async () => {
    await hooks.afterResponse(setupEvent())
    await hooks.afterResponse(setupEvent('POST'))
    expect(log.debug).toHaveBeenCalledOnce()
    expect(log.info).toHaveBeenCalledOnce()
  })

  it('reports application errors without an HTTP event', async () => {
    await hooks.error(new Error('Task failed'), {})
    expect(log.error).toHaveBeenCalledWith(
      'Background application error',
      expect.objectContaining({ error: expect.objectContaining({ message: 'Task failed' }) }),
    )
  })
})
