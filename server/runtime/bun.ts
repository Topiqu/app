// Keep the request/websocket adapter aligned with nitropack@2.13.5's Bun preset.
import '#nitro-internal-pollyfills'
import { Cron } from 'croner'
import { isTest } from 'std-env'
import wsAdapter from 'crossws/adapters/bun'
import { runTask, useNitroApp } from 'nitropack/runtime'

import { scheduledTasks } from '#nitro-internal-virtual/tasks'

import { readBunRequestBody, RequestBodyError } from './bunBody'
import { MULTIPART_BODY_MAX_BYTES } from '../../shared/utils/requestLimits'
import { bunShutdownTimeout, createBunLifecycle, settleBunCloseHooks, type BunShutdownServer } from './bunLifecycle'

// A narrow native boundary avoids adding a runtime dependency solely for Bun's type declarations.
interface NativeServer extends BunShutdownServer {
  url: URL
}
declare const Bun: {
  serve(options: {
    port: string | number
    hostname?: string
    idleTimeout?: number
    maxRequestBodySize?: number
    websocket?: ReturnType<typeof wsAdapter>['websocket']
    fetch(
      request: Request,
      server: Parameters<ReturnType<typeof wsAdapter>['handleUpgrade']>[1],
    ): Promise<Response | undefined>
  }): NativeServer
}

const nitroApp = useNitroApp()
const lifecycle = createBunLifecycle({
  timeoutMs: bunShutdownTimeout(process.env.NITRO_SHUTDOWN_TIMEOUT),
  async close() {
    // Public Hookable API: start every closer, then wait for every result even if one rejects.
    await nitroApp.hooks.callHookWith(settleBunCloseHooks, 'close')
  },
  report(message, error) {
    nitroApp.captureError(error, {
      tags: [message === 'Background work failed' ? 'background' : 'shutdown'],
      extra: { stage: message },
    })
    console.error(message)
  },
  exit: (code) => process.exit(code),
})
const websocketEnabled = import.meta._websocket
const tasksEnabled = import.meta._tasks
const ws = websocketEnabled ? wsAdapter(nitroApp.h3App.websocket) : undefined
const idleTimeout = Number.parseInt(process.env.NITRO_BUN_IDLE_TIMEOUT ?? '', 10)
const server = Bun.serve({
  port: process.env.NITRO_PORT || process.env.PORT || 3000,
  hostname: process.env.NITRO_HOST || process.env.HOST,
  idleTimeout: Number.isNaN(idleTimeout) ? undefined : idleTimeout,
  maxRequestBodySize: MULTIPART_BODY_MAX_BYTES,
  websocket: ws?.websocket,
  async fetch(request, nativeServer) {
    if (lifecycle.stopping)
      return new Response('Service unavailable', { status: 503, headers: { connection: 'close' } })
    if (ws && request.headers.get('upgrade') === 'websocket') return ws.handleUpgrade(request, nativeServer)
    const url = new URL(request.url)
    let body: ArrayBuffer | undefined
    try {
      body = await readBunRequestBody(request)
      if (request.signal.aborted) throw new RequestBodyError(400)
    } catch (error) {
      const status = error instanceof RequestBodyError ? error.status : request.signal.aborted ? 400 : 500
      if (status === 500) {
        try {
          nitroApp.captureError(new Error('REQUEST_BODY_READ_FAILED'), { tags: ['request-body'] })
        } catch {
          console.error('Request body read failed')
        }
      }
      return new Response(status === 413 ? 'Payload Too Large' : 'Invalid request body', {
        status,
        headers: { 'cache-control': 'no-store' },
      })
    }
    let headers = request.headers
    const contentType = headers.get('content-type')
    const normalizedContentType = contentType?.replace(/^multipart\/form-data(?=\s*(?:;|$))/i, 'multipart/form-data')
    if (normalizedContentType && normalizedContentType !== contentType) {
      // Nuxt Security compares this media type case-sensitively; boundary parameters must retain their case.
      headers = new Headers(headers)
      headers.set('content-type', normalizedContentType)
    }
    return nitroApp.localFetch(url.pathname + url.search, {
      host: url.hostname,
      protocol: url.protocol,
      headers,
      method: request.method,
      redirect: request.redirect,
      body,
      context: { waitUntil: lifecycle.track },
    })
  },
})
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    void lifecycle.shutdown(server)
  })
console.log(`Listening on ${server.url}...`)
if (tasksEnabled && !isTest) {
  const payload = { scheduledTime: Date.now() }
  for (const schedule of scheduledTasks || []) {
    lifecycle.addSchedule(
      new Cron(schedule.cron, () =>
        Promise.all(schedule.tasks.map((name) => lifecycle.run(() => runTask(name, { payload, context: {} })))),
      ),
    )
  }
}
