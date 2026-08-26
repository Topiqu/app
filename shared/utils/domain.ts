export const normalizeDomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/\.$/, '')

export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'cdn',
  'static',
  'help',
  'support',
  'docs',
  'auth',
  'login',
  'logout',
  'register',
  'master',
  'topiqu',
  'status',
  'dashboard',
  'billing',
])

export type SubdomainReason = 'empty' | 'tooShort' | 'invalid' | 'reserved'

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/

export const validateSubdomain = (value: string): SubdomainReason | null => {
  const subdomain = value.trim().toLowerCase()
  if (!subdomain) return 'empty'
  if (subdomain.length < 3) return 'tooShort'
  if (!SUBDOMAIN_RE.test(subdomain)) return 'invalid'
  if (RESERVED_SUBDOMAINS.has(subdomain)) return 'reserved'
  return null
}

/** Bare hostname of a `Host` header: no scheme, no port, no `www.`. */
export const toHostname = (value: string) =>
  normalizeDomain(value)
    .split(':')[0]!
    .replace(/^www\./, '')

/** The platform's own hosts. Neither serves a tenant blog, so neither has a sitemap or a feed. */
export const isRootHost = (host: string, baseDomain: string) => {
  const hostname = toHostname(host)
  const base = toHostname(baseDomain)
  return hostname === base || hostname === `app.${base}`
}

/**
 * Admin surfaces read their tenant from the hostname (`useClientSite()`) but act on the session's
 * tenant, so on someone else's blog the two disagree. Root hosts resolve to no tenant at all.
 */
export const isForeignHost = (hostTenantId: string | null | undefined, sessionTenantId: string | null | undefined) =>
  !!hostTenantId && hostTenantId !== sessionTenantId

export const isValidDomain = (value: string) => {
  const domain = normalizeDomain(value)
  if (!domain || domain.length > 253 || domain.includes('..')) return false
  return domain.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
}

export const isManagedDomain = (domain: string, baseDomain = process.env.BASE_DOMAIN || 'topiqu.com') => {
  const normalized = normalizeDomain(domain)
  const base = normalizeDomain(baseDomain)
  return normalized === base || normalized.endsWith(`.${base}`)
}

export const domainVerificationDefaults = (domain: string, token: string, baseDomain?: string) => {
  const managed = isManagedDomain(domain, baseDomain)
  const now = new Date()
  return {
    domainVerified: managed,
    domainVerificationStatus: managed ? ('VERIFIED' as const) : ('PENDING' as const),
    domainVerificationToken: managed ? null : token,
    domainVerificationIssuedAt: managed ? null : now,
    domainVerifiedAt: managed ? now : null,
    domainLastCheckedAt: null,
    domainRoutingVerified: managed,
    domainVerificationFailures: 0,
    domainVerificationDegradedAt: null,
    domainVerificationError: null,
  }
}
