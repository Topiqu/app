import { isValidDomain, normalizeDomain } from '~~/shared/utils/domain'

/** Public navigation uses the project's domain and language, not the dashboard's host or locale. */
export const publicationUrl = (
  site: { domain: string; domainVerified: boolean; language: string } | null | undefined,
  path?: string,
) => {
  if (!site?.domainVerified || !isValidDomain(site.domain)) return undefined
  return `https://${normalizeDomain(site.domain)}${path ?? `/${site.language}`}`
}
