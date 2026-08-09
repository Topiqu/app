export const normalizeDomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/\.$/, '')

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
