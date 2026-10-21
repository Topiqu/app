const transferUrl = (value: unknown): value is string =>
  typeof value === 'string' && /\/api\/auth\/transfer\//.test(value)

/** Navigation/HTTP breadcrumbs can outlive the short-lived handoff page. */
export const scrubAuthTransferBreadcrumb = <T extends { data?: Record<string, unknown> }>(breadcrumb: T): T => {
  const data = breadcrumb.data
  if (!data || !['url', 'to', 'from'].some((key) => transferUrl(data[key]))) return breadcrumb
  const safe: Record<string, unknown> = {}
  for (const key of ['url', 'to', 'from']) {
    if (typeof data[key] === 'string') safe[key] = transferUrl(data[key]) ? data[key].split('?')[0] : data[key]
  }
  breadcrumb.data = safe
  return breadcrumb
}
