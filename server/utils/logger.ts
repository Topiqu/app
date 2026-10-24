import { logLevelEnabled, sanitizeLogContext, sanitizeLogText, type LogLevel } from './logging'

type LogContext = Record<string, unknown>

const SOURCE_TOKEN = process.env.BETTERSTACK_SOURCE_TOKEN
const INGEST_HOST = process.env.BETTERSTACK_INGEST_HOST?.replace(/^https?:\/\//, '').replace(/\/$/, '')

const consoleMethod: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

const pending: Array<Record<string, unknown>> = []
let sending = false
let lastTransportWarning = 0

const transportWarning = (reason: string) => {
  if (Date.now() - lastTransportWarning < 60_000) return
  lastTransportWarning = Date.now()
  consoleMethod.warn(JSON.stringify({ level: 'warn', source: 'logging', message: reason }))
}

async function drain(): Promise<void> {
  if (sending) return
  sending = true
  try {
    while (pending.length) {
      const entry = pending.shift()!
      try {
        await $fetch(`https://${INGEST_HOST}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SOURCE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: entry,
          timeout: 5000,
          retry: 0,
        })
      } catch {
        transportWarning('External log delivery failed; the original record remains in container logs.')
      }
    }
  } finally {
    sending = false
  }
}

async function ship(level: LogLevel, message: string, context?: LogContext): Promise<void> {
  if (!logLevelEnabled(level)) return
  const entry = {
    source: 'app',
    ...sanitizeLogContext(context ?? {}),
    dt: new Date().toISOString(),
    level,
    message: sanitizeLogText(message),
    environment: process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  }
  // A single JSON line keeps container collectors from splitting one event into unrelated records.
  consoleMethod[level](JSON.stringify(entry))
  if (!SOURCE_TOKEN || !INGEST_HOST) return
  if (pending.length >= 200) {
    transportWarning('External log queue is full; additional records remain in container logs.')
    return
  }
  pending.push(entry)
  void drain()
}

export const logger = {
  debug: (message: string, context?: LogContext) => ship('debug', message, context),
  info: (message: string, context?: LogContext) => ship('info', message, context),
  warn: (message: string, context?: LogContext) => ship('warn', message, context),
  error: (message: string, context?: LogContext) => ship('error', message, context),
}
