import { isValidDomain, normalizeDomain } from '~~/shared/utils/domain'

/** Public navigation uses the project's domain and language, not the dashboard's host or locale. */
export const publicationUrl = (
  site: { domain: string; domainVerified: boolean; language: string } | null | undefined,
  path?: string,
  requestUrl?: URL,
) => {
  if (!site?.domainVerified || !isValidDomain(site.domain)) return undefined
  const domain = normalizeDomain(site.domain)
  const isLoopback = (hostname: string) =>
    hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1'
  const localOrigin =
    requestUrl &&
    isLoopback(requestUrl.hostname) &&
    isLoopback(domain) &&
    ['http:', 'https:'].includes(requestUrl.protocol)
  const origin = localOrigin
    ? `${requestUrl.protocol}//${domain}${requestUrl.port ? `:${requestUrl.port}` : ''}`
    : `https://${domain}`
  return `${origin}${path ?? `/${site.language}`}`
}
