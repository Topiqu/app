import { isValidDomain, normalizeDomain } from '~~/shared/utils/domain'

/** A tenant change starts at its dashboard so tenant-specific route IDs cannot carry over. */
export const tenantAdminUrl = (
  site: { domain: string; domainVerified: boolean },
  currentHref: string,
  adminPath: string,
  baseDomain: string,
) => {
  const current = new URL(currentHref)
  const domain = normalizeDomain(site.domain)
  const targetHost = site.domainVerified && isValidDomain(domain)
    ? domain
    : current.hostname === 'localhost' || current.hostname === '127.0.0.1'
      ? current.hostname
      : `app.${normalizeDomain(baseDomain)}`

  if (!isValidDomain(targetHost)) throw new Error('Invalid tenant domain')

  const destination = new URL(adminPath, current)
  destination.hostname = targetHost
  if (targetHost !== current.hostname) destination.port = ''
  if (targetHost !== 'localhost' && targetHost !== '127.0.0.1') destination.protocol = 'https:'
  return destination.href
}
