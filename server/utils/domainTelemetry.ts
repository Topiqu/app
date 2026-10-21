interface DomainTelemetry {
  request?: { url?: string; data?: unknown; cookies?: unknown; headers?: unknown }
  extra?: unknown
  breadcrumbs?: unknown[]
}

/** Certificate requests must never export PEM/key bodies or inherited HTTP breadcrumbs. */
export const scrubDomainTelemetry = (event: DomainTelemetry) => {
  if (!/\/api\/(?:domain\/certificate(?:[/?]|$)|auth\/transfer\/)/.test(event.request?.url ?? '')) return false
  if (event.request) {
    if (event.request.url) event.request.url = event.request.url.split('?')[0]
    delete event.request.data
    delete event.request.cookies
    delete event.request.headers
  }
  delete event.extra
  event.breadcrumbs = []
  return true
}
