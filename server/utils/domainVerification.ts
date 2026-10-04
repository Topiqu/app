import type { H3Event } from 'h3'

import { normalizeDomain } from '~~/shared/utils/domain'

/** Taken by another tenant's live domain, or by an old domain that still redirects to its blog. */
export const isDomainTaken = async (domain: string, exceptClientSiteId?: string) => {
  const host = normalizeDomain(domain)
  const [site, redirect] = await Promise.all([
    prisma.clientSite.findFirst({
      where: { domain: host, ...(exceptClientSiteId ? { id: { not: exceptClientSiteId } } : {}) },
      select: { id: true },
    }),
    prisma.domainRedirect.findFirst({
      where: { host, ...(exceptClientSiteId ? { clientSiteId: { not: exceptClientSiteId } } : {}) },
      select: { id: true },
    }),
  ])
  return Boolean(site || redirect)
}

export const DOMAIN_ROUTING_TARGET = normalizeDomain(process.env.DOMAIN_ROUTING_TARGET || 'domains.topiqu.com')
export const verificationRecordName = (domain: string) => `_topiqu-verification.${normalizeDomain(domain)}`
export const verificationRecordValue = (token: string) => `topiqu-verification=${token}`

export const domainDnsRecords = (domain: string, token: string) => ({
  domain,
  txt: { name: verificationRecordName(domain), value: verificationRecordValue(token) },
  routing: { type: 'CNAME' as const, name: domain, value: DOMAIN_ROUTING_TARGET },
})

export const requireDomainAccess = async (event: H3Event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'TENANT_SETTINGS', user.clientSiteId!)
  return { user, db, clientSiteId: user.clientSiteId! }
}

interface DnsAnswer {
  name?: string
  type?: number
  data: string
}

interface DnsResponse {
  Status: number
  Answer?: DnsAnswer[]
}

export interface DomainDnsResult {
  ownershipVerified: boolean
  routingVerified: boolean
  txtValues: string[]
  routingTargets: string[]
  dnsStatus: { txt: number; cname: number }
  error: string | null
}

export const nextReverificationState = (params: {
  failures: number
  status: 'VERIFIED' | 'DEGRADED'
  degradedAt: Date | null
  now: Date
  failureThreshold?: number
  gracePeriodMs?: number
}) => {
  const failures = params.failures + 1
  const shouldDegrade = failures >= (params.failureThreshold ?? 3)
  const degradedAt = params.degradedAt ?? (shouldDegrade ? params.now : null)
  const graceExpired = degradedAt
    ? params.now.getTime() - degradedAt.getTime() >= (params.gracePeriodMs ?? 7 * 24 * 60 * 60 * 1000)
    : false
  return {
    failures,
    degradedAt,
    domainVerified: !graceExpired,
    status: graceExpired ? ('FAILED' as const) : shouldDegrade ? ('DEGRADED' as const) : params.status,
  }
}

const queryDns = async (name: string, type: 'TXT' | 'CNAME'): Promise<DnsResponse> =>
  $fetch<DnsResponse>('https://cloudflare-dns.com/dns-query' as string, {
    query: { name, type },
    headers: { accept: 'application/dns-json' },
    timeout: 5000,
    retry: 1,
  })

const cleanTxt = (value: string) => value.replace(/^"|"$/g, '').replace(/"\s*"/g, '')

export const evaluateDomainDns = (
  txt: DnsResponse,
  cname: DnsResponse,
  token: string,
  expectedTarget = DOMAIN_ROUTING_TARGET,
): DomainDnsResult => {
  const txtValues = (txt.Answer ?? []).filter((a) => a.type === 16).map((a) => cleanTxt(a.data))
  const routingTargets = (cname.Answer ?? []).filter((a) => a.type === 5).map((a) => normalizeDomain(a.data))
  const ownershipVerified = txt.Status === 0 && txtValues.includes(verificationRecordValue(token))
  const routingVerified = cname.Status === 0 && routingTargets.includes(normalizeDomain(expectedTarget))
  const error =
    txt.Status !== 0 ? `TXT_DNS_STATUS_${txt.Status}` : cname.Status !== 0 ? `CNAME_DNS_STATUS_${cname.Status}` : null
  return {
    ownershipVerified,
    routingVerified,
    txtValues,
    routingTargets,
    dnsStatus: { txt: txt.Status, cname: cname.Status },
    error,
  }
}

export const checkDomainDns = async (domain: string, token: string): Promise<DomainDnsResult> => {
  const normalized = normalizeDomain(domain)
  try {
    const [txt, cname] = await Promise.all([
      queryDns(verificationRecordName(normalized), 'TXT'),
      queryDns(normalized, 'CNAME'),
    ])
    return evaluateDomainDns(txt, cname, token)
  } catch (error) {
    await logger.warn('domain verification DNS lookup failed', {
      source: 'domain-verification',
      domain: normalized,
      error: (error as Error).message,
    })
    return {
      ownershipVerified: false,
      routingVerified: false,
      txtValues: [],
      routingTargets: [],
      dnsStatus: { txt: -1, cname: -1 },
      error: 'DNS_LOOKUP_FAILED',
    }
  }
}
