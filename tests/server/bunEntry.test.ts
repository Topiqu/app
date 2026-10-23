// @vitest-environment node
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MULTIPART_BODY_MAX_BYTES, REQUEST_BODY_MAX_BYTES } from '../../shared/utils/requestLimits'

type Schedules = { cron: string; tasks: string[] }[] | false

async function installedSizeLimiter() {
  const sources: Record<string, string> = {
    h3: `
      export const defineEventHandler = handler => handler
      export const getRequestHeader = (event, name) => event.node.req.headers[name]
      export const createError = error => Object.assign(new Error(error.statusMessage), error)
    `,
    '#imports': 'export const useRuntimeConfig = () => ({})',
    '../../nitro/context/index.js': `export const resolveSecurityRules = () => ({
      enabled: true,
      requestSizeLimiter: ${JSON.stringify({
        maxRequestSizeInBytes: REQUEST_BODY_MAX_BYTES + 1,
        maxUploadFileRequestInBytes: MULTIPART_BODY_MAX_BYTES + 1,
      })}
    })`,
  }
  const bundled = await build({
    entryPoints: [
      fileURLToPath(
        new URL(
          '../../node_modules/nuxt-security/dist/runtime/server/middleware/requestSizeLimiter.js',
          import.meta.url,
        ),
      ),
    ],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    resolveExtensions: ['.mjs', '.js', '.json'],
    plugins: [
      {
        name: 'installed-size-limiter-boundaries',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, ({ path }) =>
            Object.hasOwn(sources, path) ? { path, namespace: 'size-limiter-boundary' } : undefined,
          )
          builder.onLoad({ filter: /.*/, namespace: 'size-limiter-boundary' }, ({ path }) => ({
            contents: sources[path]!,
            loader: 'js',
          }))
        },
      },
    ],
  })
  const url = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0]!.text).toString('base64')}`
  return (await import(/* @vite-ignore */ url)).default as (event: {
    node: { req: { method: string; headers: Record<string, string> } }
  }) => void
}

async function entry(scheduledTasks: Schedules, isTest: boolean, tasksEnabled = true) {
  const schedules: { cron: string; callback: () => Promise<unknown> }[] = []
  const localFetch = vi.fn(async (_path: string, _init: Record<string, unknown>) => new Response('ok'))
  const runTask = vi.fn().mockResolvedValue({ result: 'ok' })
  let nativeFetch!: (request: Request, server: unknown) => Promise<Response | undefined>
  const serve = vi.fn((options: { fetch: typeof nativeFetch }) => {
    nativeFetch = options.fetch
    return { url: new URL('http://127.0.0.1:3000'), stop: vi.fn().mockResolvedValue(undefined) }
  })
  const fixture = {
    native: { serve },
    onSignal: vi.fn(),
    log: vi.fn(),
    nitro: {
      h3App: { websocket: {} },
      hooks: { callHookWith: vi.fn().mockResolvedValue(undefined) },
      captureError: vi.fn(),
      localFetch,
    },
    runTask,
    createCron(cron: string, callback: () => Promise<unknown>) {
      schedules.push({ cron, callback })
      return { stop: vi.fn() }
    },
  }
  vi.stubGlobal('__topiquBunEntryFixture', fixture)
  vi.stubEnv('NITRO_SHUTDOWN_TIMEOUT', '8000')
  const sources: Record<string, string> = {
    '#nitro-internal-pollyfills': 'export {}',
    '#nitro-internal-virtual/tasks': `export const scheduledTasks = ${JSON.stringify(scheduledTasks)}`,
    'std-env': `export const isTest = ${isTest}`,
    croner:
      'export class Cron { constructor(cron, callback) { return globalThis.__topiquBunEntryFixture.createCron(cron, callback) } }',
    'crossws/adapters/bun': 'export default () => { throw new Error("Unexpected websocket adapter initialization") }',
    'nitropack/runtime': `
      export const useNitroApp = () => globalThis.__topiquBunEntryFixture.nitro
      export const runTask = (...args) => globalThis.__topiquBunEntryFixture.runTask(...args)
    `,
  }
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('../../server/runtime/bun.ts', import.meta.url))],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    define: {
      'import.meta._tasks': String(tasksEnabled),
      'import.meta._websocket': 'false',
      Bun: 'globalThis.__topiquBunEntryFixture.native',
      'process.on': 'globalThis.__topiquBunEntryFixture.onSignal',
      'console.log': 'globalThis.__topiquBunEntryFixture.log',
    },
    plugins: [
      {
        name: 'bun-entry-boundaries',
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, ({ path }) =>
            Object.hasOwn(sources, path) ? { path, namespace: 'bun-entry-boundary' } : undefined,
          )
          builder.onLoad({ filter: /.*/, namespace: 'bun-entry-boundary' }, ({ path }) => ({
            contents: sources[path]!,
            loader: 'js',
          }))
        },
      },
    ],
  })
  // Execute the authored entry, replacing only native/framework boundaries; no HTTP listener starts.
  const source = `${bundled.outputFiles[0]!.text}\n// Isolated fixture ${crypto.randomUUID()}`
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  await import(/* @vite-ignore */ url)
  return {
    serve,
    schedules,
    localFetch,
    runTask,
    captureError: fixture.nitro.captureError,
    onSignal: fixture.onSignal,
    fetch: (request: Request) => nativeFetch(request, {}),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('authored Bun entry', () => {
  it('rejects streamed oversized PATCH bodies before forwarding them to Nitro', async () => {
    const runtime = await entry(false, true)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1_000_000))
        controller.enqueue(new Uint8Array(1_000_001))
        controller.close()
      },
    })
    const request = new Request('http://localhost/api/articles/fixture', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'content-length': '1' },
      body: stream,
      duplex: 'half',
    } as RequestInit)
    await expect(runtime.fetch(request)).resolves.toMatchObject({ status: 413 })
    expect(runtime.localFetch).not.toHaveBeenCalled()
  })

  it('sets the native cap and forwards allowed multipart bytes unchanged', async () => {
    const runtime = await entry(false, true)
    expect(runtime.serve).toHaveBeenCalledWith(expect.objectContaining({ maxRequestBodySize: 16 * 1024 * 1024 }))
    const body = new Uint8Array(10 * 1024 * 1024 + 1024)
    const response = await runtime.fetch(
      new Request('http://localhost/api/users/avatar', {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=x' },
        body,
      }),
    )
    expect(response?.status).toBe(200)
    expect(runtime.localFetch).toHaveBeenCalledWith(
      '/api/users/avatar',
      expect.objectContaining({ body: expect.any(ArrayBuffer) }),
    )
    expect((runtime.localFetch.mock.calls[0]![1].body as ArrayBuffer).byteLength).toBe(body.byteLength)
  })

  it.each([
    'Multipart/Form-Data; boundary=TopiquCaseSensitiveBoundary',
    'MULTIPART/FORM-DATA ; boundary="TopiquCaseSensitiveBoundary"',
  ])('forwards supported multipart media type %s through the installed security limiter', async (contentType) => {
    const runtime = await entry(false, true)
    const limiter = await installedSizeLimiter()
    runtime.localFetch.mockImplementation(async (_path, init) => {
      limiter({
        node: {
          req: {
            method: init.method as string,
            headers: Object.fromEntries(new Headers(init.headers as HeadersInit)),
          },
        },
      })
      return new Response('ok')
    })
    const body = new Uint8Array(10 * 1024 * 1024)
    await expect(
      runtime.fetch(
        new Request('http://localhost/api/users/avatar', {
          method: 'POST',
          headers: { 'content-type': contentType, 'content-length': String(body.byteLength) },
          body,
        }),
      ),
    ).resolves.toMatchObject({ status: 200 })
    const forwarded = runtime.localFetch.mock.calls[0]![1]
    expect(new Headers(forwarded.headers as HeadersInit).get('content-type')).toBe(
      contentType.replace(/^multipart\/form-data/i, 'multipart/form-data'),
    )
    expect((forwarded.body as ArrayBuffer).byteLength).toBe(body.byteLength)
  })

  it('never dispatches an aborted body or exposes a reader failure', async () => {
    const runtime = await entry(false, true)
    const controller = new AbortController()
    const request = new Request('http://localhost/api/articles/fixture', {
      method: 'PATCH',
      body: new ReadableStream({}),
      signal: controller.signal,
      duplex: 'half',
    } as RequestInit)
    const reading = runtime.fetch(request)
    controller.abort()
    await expect(reading).resolves.toMatchObject({ status: 400 })
    expect(runtime.localFetch).not.toHaveBeenCalled()
    expect(runtime.captureError).not.toHaveBeenCalled()

    const failed = new Request('http://localhost/api/articles/fixture', {
      method: 'PATCH',
      body: new ReadableStream({ start: (stream) => stream.error(new Error('Synthetic private body details')) }),
      duplex: 'half',
    } as RequestInit)
    const response = await runtime.fetch(failed)
    expect(response?.status).toBe(500)
    expect(await response!.text()).not.toContain('private body details')
    expect(runtime.captureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'REQUEST_BODY_READ_FAILED' }),
      { tags: ['request-body'] },
    )
    expect(runtime.localFetch).not.toHaveBeenCalled()
    runtime.captureError.mockImplementationOnce(() => {
      throw new Error('Synthetic reporting failure')
    })
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})
    await expect(runtime.fetch(failed)).resolves.toMatchObject({ status: 500 })
  })

  it("starts with Nitro's literal false sentinel for an empty schedule set", async () => {
    // Nitro 2.13.5 virtual tasks generator emits false, rather than an empty array or undefined.
    const runtime = await entry(false, false)
    expect(runtime.serve).toHaveBeenCalledOnce()
    expect(runtime.onSignal.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGINT'])
    expect(runtime.schedules).toEqual([])
    await expect(runtime.fetch(new Request('http://localhost/api/live'))).resolves.toMatchObject({ status: 200 })
    expect(runtime.localFetch).toHaveBeenCalledWith(
      '/api/live',
      expect.objectContaining({
        context: { waitUntil: expect.any(Function) },
      }),
    )
  })

  it('excludes populated schedules when std-env identifies a test runtime', async () => {
    const runtime = await entry([{ cron: '0 * * * *', tasks: ['community-insights'] }], true)
    expect(runtime.serve).toHaveBeenCalledOnce()
    expect(runtime.schedules).toEqual([])
    expect(runtime.runTask).not.toHaveBeenCalled()
  })

  it('starts configured schedules and dispatches the public Nitro task API outside tests', async () => {
    const runtime = await entry([{ cron: '0 * * * *', tasks: ['community-insights'] }], false)
    expect(runtime.schedules).toHaveLength(1)
    expect(runtime.schedules[0]!.cron).toBe('0 * * * *')
    await runtime.schedules[0]!.callback()
    expect(runtime.runTask).toHaveBeenCalledExactlyOnceWith('community-insights', {
      payload: { scheduledTime: expect.any(Number) },
      context: {},
    })
  })

  it('keeps schedules excluded when Nitro compiles task support out', async () => {
    const runtime = await entry([{ cron: '0 * * * *', tasks: ['community-insights'] }], false, false)
    expect(runtime.serve).toHaveBeenCalledOnce()
    expect(runtime.schedules).toEqual([])
  })
})
