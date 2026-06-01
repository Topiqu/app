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

async function ship(level: LogLevel, message: string, context?: LogContext): Promise<void> {
  consoleMethod[level](`[${level}] ${message}`, context ?? '')

  if (!SOURCE_TOKEN || !INGEST_HOST) return

  try {
    await $fetch(`https://${INGEST_HOST}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SOURCE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: {
        dt: new Date().toISOString(),
        level,
        message,
        environment:
          process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
        ...context,
      },
      timeout: 5000,
      retry: 1,
    })
  } catch {
    return
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => ship('debug', message, context),
  info: (message: string, context?: LogContext) => ship('info', message, context),
  warn: (message: string, context?: LogContext) => ship('warn', message, context),
  error: (message: string, context?: LogContext) => ship('error', message, context),
}
