import { z } from 'zod'
import { $fetch } from 'ofetch'

export class DomainProviderError extends Error {
  readonly statusCode: number
  readonly data: { code: string }
  constructor(
    public readonly code: string,
    public readonly httpStatus?: number,
  ) {
    super(code)
    this.name = 'DomainProviderError'
    this.statusCode = [
      'BUSY',
      'DOMAIN_RESERVED',
      'DOMAIN_LIMIT',
      'DOMAIN_CLEANUP_PENDING',
      'ADOPTION_REQUIRED',
    ].includes(code)
      ? 409
      : 503
    this.data = { code }
  }
}

export const domainProviderConfig = () => {
  const result = z
    .object({
      cloudflareToken: z.string().min(20),
      zoneId: z.string().regex(/^[a-f0-9]{32}$/i),
      fallbackOrigin: z
        .string()
        .regex(/^[a-z0-9.-]+$/i)
        .min(3)
        .max(253),
      dokployToken: z.string().min(10),
      applicationId: z.string().min(1).max(200),
      organizationId: z.string().min(1).max(200),
      dokployUrl: z.url().refine((value) => {
        const url = new URL(value)
        return (
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.pathname === '/'
        )
      }),
      port: z.coerce.number().int().min(1).max(65535),
    })
    .safeParse({
      cloudflareToken: process.env.CLOUDFLARE_API_TOKEN,
      zoneId: process.env.CLOUDFLARE_ZONE_ID,
      fallbackOrigin: process.env.CLOUDFLARE_FALLBACK_ORIGIN,
      dokployToken: process.env.DOKPLOY_API_KEY,
      applicationId: process.env.DOKPLOY_APPLICATION_ID,
      organizationId: process.env.DOKPLOY_ORGANIZATION_ID,
      dokployUrl: process.env.DOKPLOY_BASE_URL,
      port: process.env.DOKPLOY_APPLICATION_PORT || '3000',
    })
  if (!result.success) throw new DomainProviderError('CONFIGURATION')
  return result.data
}

export const checkCloudflareFallback = async () => {
  const config = domainProviderConfig()
  try {
    const result = await $fetch<unknown>(
      `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames/fallback_origin`,
      {
        headers: { authorization: `Bearer ${config.cloudflareToken}` },
        timeout: 5000,
        retry: 0,
        redirect: 'error',
        responseType: 'json',
      },
    )
    const parsed = z
      .object({ success: z.literal(true), result: z.object({ origin: z.string(), status: z.literal('active') }) })
      .parse(result)
    if (parsed.result.origin.toLowerCase() !== config.fallbackOrigin.toLowerCase())
      throw new DomainProviderError('CONFIGURATION')
  } catch (error) {
    if (error instanceof DomainProviderError) throw error
    throw new DomainProviderError('CLOUDFLARE_UNAVAILABLE')
  }
}

const validationRecord = z.object({
  txt_name: z.string().max(512).optional(),
  txt_value: z.string().max(4096).optional(),
  cname: z.string().max(512).optional(),
  cname_target: z.string().max(512).optional(),
})
export const cloudflareHostnameSchema = z.object({
  id: z.string().uuid(),
  hostname: z.string(),
  status: z.string(),
  ownership_verification: z.object({ type: z.string(), name: z.string(), value: z.string() }).nullish(),
  ssl: z.object({ status: z.string().optional(), validation_records: z.array(validationRecord).optional() }).nullish(),
})
export type CloudflareHostname = z.infer<typeof cloudflareHostnameSchema>

export const cloudflareDomain = async (method: 'GET' | 'POST' | 'DELETE', id?: string, hostname?: string) => {
  const config = domainProviderConfig()
  if (id && !z.string().uuid().safeParse(id).success) throw new DomainProviderError('PROVIDER_ID')
  try {
    const response = await $fetch<unknown>(
      `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames${id ? `/${id}` : ''}`,
      {
        method,
        headers: { authorization: `Bearer ${config.cloudflareToken}` },
        query: method === 'GET' && !id ? { hostname, per_page: 50 } : undefined,
        body:
          method === 'POST'
            ? { hostname, ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.2' } } }
            : undefined,
        timeout: 10000,
        retry: 0,
        redirect: 'error',
        responseType: 'json',
      },
    )
    const envelope = z.object({ success: z.literal(true), result: z.unknown() }).parse(response)
    if (method === 'DELETE') return null
    if (method === 'GET' && !id) {
      const matches = z
        .array(cloudflareHostnameSchema)
        .parse(envelope.result)
        .filter((entry) => entry.hostname === hostname)
      if (matches.length > 1) throw new DomainProviderError('PROVIDER_CONFLICT')
      return matches[0] ?? null
    }
    return cloudflareHostnameSchema.parse(envelope.result)
  } catch (error) {
    if (error instanceof DomainProviderError) throw error
    const status = (error as { statusCode?: number })?.statusCode
    if (method === 'GET' && id && status === 404) return null
    // FetchError contains authorization headers, request bodies and customer keys. Never propagate it.
    throw new DomainProviderError('CLOUDFLARE_UNAVAILABLE', status)
  }
}

export const dokployDomainSchema = z.object({
  domainId: z.string().min(1).max(200),
  host: z.string(),
  applicationId: z.string().nullable().optional(),
  port: z.number().nullable().optional(),
  path: z.string().nullable().optional(),
  https: z.boolean().optional(),
  certificateType: z.string().nullable().optional(),
})
export type DokployDomain = z.infer<typeof dokployDomainSchema>

export const dokployRequest = async (operation: string, method: 'GET' | 'POST', data: Record<string, unknown>) => {
  const config = domainProviderConfig()
  const operations = [
    'domain.byApplicationId',
    'domain.one',
    'domain.create',
    'domain.update',
    'domain.delete',
    'certificates.create',
    'certificates.one',
    'certificates.update',
    'certificates.remove',
  ]
  if (!operations.includes(operation)) throw new DomainProviderError('PROVIDER_OPERATION')
  try {
    return await $fetch<unknown>(new URL(`/api/${operation}`, config.dokployUrl).href, {
      method,
      headers: { 'x-api-key': config.dokployToken },
      query: method === 'GET' ? data : undefined,
      body: method === 'POST' ? data : undefined,
      timeout: 10000,
      retry: 0,
      redirect: 'error',
      responseType: 'json',
    })
  } catch (error) {
    throw new DomainProviderError('DOKPLOY_UNAVAILABLE', (error as { statusCode?: number })?.statusCode)
  }
}

export const findDokployDomain = async (host: string, id?: string) => {
  const config = domainProviderConfig()
  let entries: DokployDomain[]
  if (id) {
    try {
      entries = [dokployDomainSchema.parse(await dokployRequest('domain.one', 'GET', { domainId: id }))]
    } catch (error) {
      if (error instanceof DomainProviderError && error.httpStatus === 404) return null
      throw error
    }
    if (entries[0]!.host.toLowerCase() !== host || entries[0]!.domainId !== id)
      throw new DomainProviderError('PROVIDER_CONFLICT')
  } else
    entries = z
      .array(dokployDomainSchema)
      .parse(await dokployRequest('domain.byApplicationId', 'GET', { applicationId: config.applicationId }))
  const matches = entries.filter((entry) => entry.host.toLowerCase() === host)
  if (matches.length > 1) throw new DomainProviderError('PROVIDER_CONFLICT')
  const entry = matches[0]
  if (
    entry &&
    (entry.applicationId !== config.applicationId || entry.port !== config.port || (entry.path && entry.path !== '/'))
  )
    throw new DomainProviderError('PROVIDER_CONFLICT')
  return entry ?? null
}

export const cloudflareValidationRecords = (entry: CloudflareHostname) => [
  ...(entry.ownership_verification?.type === 'txt'
    ? [{ type: 'TXT', name: entry.ownership_verification.name, value: entry.ownership_verification.value }]
    : []),
  ...(entry.ssl?.validation_records ?? []).flatMap((record) =>
    record.txt_name && record.txt_value
      ? [{ type: 'TXT', name: record.txt_name, value: record.txt_value }]
      : record.cname && record.cname_target
        ? [{ type: 'CNAME', name: record.cname, value: record.cname_target }]
        : [],
  ),
]
