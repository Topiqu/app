import type { H3Event } from 'h3'

const TENANT_SELECT = {
  id: true,
  name: true,
  domain: true,
  domainVerified: true,
  description: true,
  logoUrl: true,
  language: true,
  plan: true,
  focus: true,
  audience: true,
} as const

/** The blog host, or null when the request is for the platform's own hosts. */
export const tenantHostname = (event: H3Event) => {
  const host = getRequestHost(event, { xForwardedHost: true })
  if (!host) return null
  return isRootHost(host, useRuntimeConfig(event).public.baseDomain) ? null : toHostname(host)
}

const loadTenant = async (hostname: string) => {
  const isProd = process.env.NODE_ENV === 'production'

  const site = await prisma.clientSite.findFirst({
    // Name also resolves outside production, matching `/api/clients/slug/[slug]`.
    where: { deletedAt: null, ...(isProd ? { domain: hostname } : { OR: [{ domain: hostname }, { name: hostname }] }) },
    select: TENANT_SELECT,
  })
  if (!site) return null

  // Unverified custom domain: anyone could point DNS at us and serve this blog under their name.
  if (isProd && !site.domainVerified && !isManagedDomain(site.domain)) return null

  return site
}

export const tenantByHost = async (event: H3Event) => {
  const hostname = tenantHostname(event)
  return hostname ? loadTenant(hostname) : null
}

export const tenantHostKey = (hostname: string) => `tenant:host:${hostname}`
export const domainRedirectKey = (hostname: string) => `domain:redirect:${hostname}`

/** Memoize only within a request: both custom-host retirement and restoration of
 * its managed fallback must be visible without waiting for a shared-cache TTL. */
export const cachedTenantByHost = async (event: H3Event) => {
  const hostname = tenantHostname(event)
  if (!hostname) return null
  return (event.context.topiquTenant ??= loadTenant(hostname)) as ReturnType<typeof loadTenant>
}

/** The domain an old host should 301 to, if the blog it belonged to is still served. */
export const domainRedirectTarget = async (hostname: string) => {
  const redirect = await prisma.domainRedirect.findUnique({
    where: { host: hostname },
    select: { clientSite: { select: { domain: true, domainVerified: true, deletedAt: true } } },
  })
  const site = redirect?.clientSite
  if (!site || site.deletedAt || (!site.domainVerified && !isManagedDomain(site.domain))) return null
  return site.domain
}

export type Tenant = NonNullable<Awaited<ReturnType<typeof tenantByHost>>>

/** Canonical origin of the request; same rule as the app's `useCanonicalOrigin`. */
export const requestOrigin = (event: H3Event) =>
  buildCanonicalOrigin(
    getRequestProtocol(event),
    getRequestHost(event, { xForwardedHost: true }) || '',
    process.env.NODE_ENV !== 'production',
  )
