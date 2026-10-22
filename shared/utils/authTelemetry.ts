const sensitiveAuthUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  /\/(?:auth-transfer|integrations-connect|oauth-start)(?:[/?#]|$)|\/api\/(?:auth\/(?:transfer|callback)\/|integrations(?:[/?#]|$)|(?:linkedin|search-console)\/callback(?:[/?#]|$))/.test(
    value,
  )

const stripQuery = (value: string) => value.split(/[?#]/)[0]!

/** Navigation/HTTP breadcrumbs can outlive the short-lived handoff page. */
export const scrubAuthTransferBreadcrumb = <T extends { data?: Record<string, unknown>; message?: string }>(
  breadcrumb: T,
): T => {
  const data = breadcrumb.data
  if (!sensitiveAuthUrl(breadcrumb.message) && !containsAuthUrl(data)) return breadcrumb
  const safe: Record<string, unknown> = {}
  for (const key of ['url', 'to', 'from']) {
    if (typeof data?.[key] === 'string') safe[key] = stripQuery(data[key])
  }
  breadcrumb.data = safe
  if (breadcrumb.message) breadcrumb.message = 'Authentication flow'
  return breadcrumb
}

const containsAuthUrl = (value: unknown, depth = 0, seen = new WeakSet<object>()): boolean => {
  if (typeof value === 'string') return sensitiveAuthUrl(value)
  if (!value || typeof value !== 'object' || depth > 6 || seen.has(value)) return false
  seen.add(value)
  return Object.values(value).some((entry) => containsAuthUrl(entry, depth + 1, seen))
}

interface AuthTelemetry {
  request?: { url?: string; method?: string; data?: unknown; cookies?: unknown; headers?: unknown }
  transaction?: string
  message?: string
  logentry?: { message?: string; params?: unknown }
  extra?: Record<string, unknown>
  tags?: Record<string, unknown>
  contexts?: Record<string, unknown>
  breadcrumbs?: Array<{ data?: Record<string, unknown>; message?: string }>
  exception?: { values?: Array<{ value?: string; type?: string; stacktrace?: unknown; mechanism?: unknown }> }
  spans?: unknown[]
  user?: unknown
}

const diagnosticCodes = (data?: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data ?? {}).filter(
      ([key, value]) =>
        /^(?:code|diagnosticCode|failureCode|error_code)$/.test(key) &&
        typeof value === 'string' &&
        /^[A-Z][A-Z0-9_]{1,79}$/.test(value),
    ),
  )

/** Credentials can appear in fetch errors, trace descriptions and inherited contexts as well as URLs. */
export const scrubAuthEvent = <T extends AuthTelemetry>(event: T): T => {
  const sensitive = containsAuthUrl([
    event.request,
    event.transaction,
    event.message,
    event.logentry,
    event.extra,
    event.contexts,
    event.exception,
    event.spans,
    event.breadcrumbs,
  ])
  for (const breadcrumb of event.breadcrumbs ?? []) scrubAuthTransferBreadcrumb(breadcrumb)
  if (!sensitive) return event
  const codes = { ...diagnosticCodes(event.extra), ...diagnosticCodes(event.tags) }
  if (event.request) {
    event.request = {
      ...(event.request.url ? { url: stripQuery(event.request.url) } : {}),
      ...(event.request.method && /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(event.request.method)
        ? { method: event.request.method }
        : {}),
    }
  }
  if (event.transaction) event.transaction = stripQuery(event.transaction)
  if (event.message)
    event.message = /^[A-Z][A-Z0-9_]{1,79}$/.test(event.message) ? event.message : 'Authentication flow failed'
  if (event.logentry) event.logentry = { message: 'Authentication flow failed' }
  event.extra = codes
  event.tags = { ...codes }
  const trace = event.contexts?.trace
  const safeTrace: Record<string, unknown> = {}
  if (trace && typeof trace === 'object')
    for (const [key, value] of Object.entries(trace)) {
      if (
        (key === 'trace_id' && typeof value === 'string' && /^[a-f0-9]{32}$/.test(value)) ||
        ((key === 'span_id' || key === 'parent_span_id') && typeof value === 'string' && /^[a-f0-9]{16}$/.test(value))
      )
        safeTrace[key] = value
    }
  event.contexts = { trace: safeTrace }
  for (const exception of event.exception?.values ?? []) {
    exception.value =
      exception.value && /^[A-Z][A-Z0-9_]{1,79}$/.test(exception.value) ? exception.value : 'Authentication flow failed'
    if (exception.type && !/^[A-Za-z]+Error$/.test(exception.type)) exception.type = 'Error'
    delete exception.stacktrace
    delete exception.mechanism
  }
  event.breadcrumbs = []
  event.spans = []
  delete event.user
  return event
}
