import { randomUUID } from 'node:crypto'
import { STATUS_CODES } from 'node:http'
import { getRequestURL, setResponseHeader, type H3Event } from 'h3'

import { logErrorDetails, sanitizeLogText } from './logging'

type RequestLog = { requestId: string; startedAt: number; errorLogged: boolean }
const requests = new WeakMap<H3Event, RequestLog>()

export const requestLogState = (event: H3Event): RequestLog => {
  let state = requests.get(event)
  if (!state) {
    state = { requestId: randomUUID(), startedAt: performance.now(), errorLogged: false }
    requests.set(event, state)
    if (!event.node.res.headersSent) setResponseHeader(event, 'x-request-id', state.requestId)
  }
  return state
}

export const requestLogContext = (event: H3Event, statusCode: number, error?: unknown) => {
  const state = requestLogState(event)
  let host = 'invalid-host'
  let protocol = 'unknown'
  let path: string
  try {
    const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
    host = url.hostname
    protocol = url.protocol.replace(':', '')
    path = url.pathname
  } catch {
    // Malformed forwarded headers must not make error reporting throw another exception.
    path = (event.node.req.url ?? '/').split('?')[0]!
  }
  const failure = error as { data?: { code?: unknown } } | undefined
  const code = failure?.data?.code
  const details = error ? logErrorDetails(error, { includeStack: statusCode >= 500 }) : undefined
  if (details?.message === 'Unknown error') details.message = STATUS_CODES[statusCode] ?? 'Request failed'
  return {
    source: 'http',
    requestId: state.requestId,
    method: event.method,
    path: sanitizeLogText(path).replace(
      /(\/(?:reset-password|verify-email|transfer|invitations?)(?:\/accept)?\/)[^/]+/gi,
      '$1[redacted]',
    ),
    host,
    protocol,
    statusCode,
    durationMs: Math.round(performance.now() - state.startedAt),
    reason: typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,99}$/.test(code) ? code : `HTTP_${statusCode}`,
    ...(details ? { error: details } : {}),
  }
}
