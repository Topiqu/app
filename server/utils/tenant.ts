import type { H3Event } from 'h3'

import { buildCanonicalOrigin } from '~~/shared/utils/seo'
import { isManagedDomain, isRootHost, toHostname } from '~~/shared/utils/domain'

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
const tenantHostname = (event: H3Event) => {
  const host = getRequestHost(event, { xForwardedHost: true })
  if (!host) return null
  return isRootHost(host, useRuntimeConfig(event).public.baseDomain) ? null : toHostname(host)
}

const loadTenant = async (hostname: string) => {
  const isProd = process.env.NODE_ENV === 'production'

  const site = await prisma.clientSite.findFirst({
    // Name also resolves outside production, matching `/api/clients/slug/[slug]`.
    where: isProd ? { domain: hostname } : { OR: [{ domain: hostname }, { name: hostname }] },
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

/** For hooks that fire on every request, where one indexed read per asset is still waste. */
export const cachedTenantByHost = async (event: H3Event) => {
  const hostname = tenantHostname(event)
  return hostname ? cached(`tenant:host:${hostname}`, 300, () => loadTenant(hostname)) : null
}

export type Tenant = NonNullable<Awaited<ReturnType<typeof tenantByHost>>>

/** Canonical origin of the request; same rule as the app's `useCanonicalOrigin`. */
export const requestOrigin = (event: H3Event) =>
  buildCanonicalOrigin(
    getRequestProtocol(event),
    getRequestHost(event, { xForwardedHost: true }) || '',
    process.env.NODE_ENV !== 'production',
  )
