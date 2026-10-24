export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const privateKey =
  /^(?:authorization|cookies?|headers?|password|secret|.*(?:_token|Token|Secret|Password|ApiKey)|apiKey|api_key|privateKey|credentials|body|payload|data|query|params|prompt|content|request|response|user|profile|session|account)$/i

export const sanitizeLogText = (value: string, limit = 1500): string => {
  let text = value
  for (const [key, secret] of Object.entries(process.env)) {
    if (
      secret &&
      secret.length >= 8 &&
      /(?:SECRET|TOKEN|PASSWORD|API_KEY|DATABASE_URL|REDIS_URL|PRIVATE_KEY)$/.test(key)
    )
      text = text.split(secret).join('[redacted]')
  }
  return text
    .replace(/https?:\/\/[^\s<>"']+/gi, (url) => {
      try {
        const parsed = new URL(url)
        return `${parsed.origin}${parsed.pathname}`.replace(
          /(\/(?:reset-password|verify-email|transfer|invitations?)(?:\/accept)?\/)[^/]+/gi,
          '$1[redacted]',
        )
      } catch {
        return '[url]'
      }
    })
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi, '[authorization]')
    .replace(
      /(["']?\b(?:access_token|refresh_token|id_token|client_secret|secret|password|token|cookie|authorization|code_verifier|state|code)\b["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
      '$1[redacted]',
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+)\b/g, '[token]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, limit)
}

export const logErrorDetails = (error: unknown): Record<string, unknown> => {
  if (!error || typeof error !== 'object') return { message: sanitizeLogText(String(error ?? 'Unknown error')) }
  const value = error as {
    name?: unknown
    message?: unknown
    statusMessage?: unknown
    code?: unknown
    stack?: unknown
    cause?: unknown
  }
  return {
    name: typeof value.name === 'string' ? sanitizeLogText(value.name, 100) : 'Error',
    message: sanitizeLogText(String(value.message || value.statusMessage || 'Unknown error')),
    ...(typeof value.code === 'string' || typeof value.code === 'number'
      ? { code: sanitizeLogText(String(value.code), 100) }
      : {}),
    ...(typeof value.stack === 'string'
      ? {
          stack: value.stack
            .split('\n')
            .slice(0, 9)
            .map((line) => sanitizeLogText(line, 500))
            .join('\n'),
        }
      : {}),
    ...(value.cause && value.cause !== error
      ? { cause: sanitizeLogText(value.cause instanceof Error ? value.cause.message : String(value.cause)) }
      : {}),
  }
}

export const sanitizeLogContext = (context: Record<string, unknown>): Record<string, unknown> => {
  const seen = new WeakSet<object>()
  let remaining = 12_000
  const visit = (value: unknown, depth: number): unknown => {
    if (remaining <= 0) return '[truncated]'
    remaining -= 20
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value
    if (typeof value === 'string') {
      const text = sanitizeLogText(value, Math.max(0, Math.min(1500, remaining)))
      remaining -= text.length
      return text
    }
    if (typeof value === 'bigint') return String(value)
    if (value instanceof Error) {
      const details = logErrorDetails(value)
      remaining -= JSON.stringify(details).length
      return details
    }
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null
    if (typeof value !== 'object') return undefined
    if (seen.has(value)) return '[circular]'
    if (depth >= 4) return '[truncated]'
    seen.add(value)
    if (Array.isArray(value)) return value.slice(0, 25).map((item) => visit(item, depth + 1))
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [key, privateKey.test(key) ? '[redacted]' : visit(item, depth + 1)]),
    )
  }
  return visit(context, 0) as Record<string, unknown>
}

export const logLevelEnabled = (level: LogLevel, configured = process.env.LOG_LEVEL): boolean => {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
  const threshold = levels.includes(configured as LogLevel) ? (configured as LogLevel) : 'info'
  return levels.indexOf(level) >= levels.indexOf(threshold)
}
