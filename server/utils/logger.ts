type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

const SOURCE_TOKEN = process.env.BETTERSTACK_SOURCE_TOKEN
const INGEST_HOST = process.env.BETTERSTACK_INGEST_HOST?.replace(/^https?:\/\//, '').replace(/\/$/, '')

const consoleMethod: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

const pending: Array<{ level: LogLevel; message: string; context?: LogContext }> = []
let sending = false

async function drain(): Promise<void> {
  if (sending) return
  sending = true
  try {
    while (pending.length) {
      const { level, message, context } = pending.shift()!
      try {
        await $fetch(`https://${INGEST_HOST}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SOURCE_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: {
            dt: new Date().toISOString(),
            level,
            message,
            environment: process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
            ...context,
          },
          timeout: 5000,
          retry: 0,
        })
      } catch {
        /* The immutable DB audit and console remain authoritative. */
      }
    }
  } finally {
    sending = false
  }
}

async function ship(level: LogLevel, message: string, context?: LogContext): Promise<void> {
  consoleMethod[level](`[${level}] ${message}`, context ?? '')
  if (!SOURCE_TOKEN || !INGEST_HOST) return
  if (pending.length >= 200) return
  pending.push({ level, message, context })
  void drain()
}

export const logger = {
  debug: (message: string, context?: LogContext) => ship('debug', message, context),
  info: (message: string, context?: LogContext) => ship('info', message, context),
  warn: (message: string, context?: LogContext) => ship('warn', message, context),
  error: (message: string, context?: LogContext) => ship('error', message, context),
}
