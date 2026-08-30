import type { PublicClientSite } from '~~/shared/utils/clientSiteFields'

export interface ClientSiteStatus {
  id: string
  name: string
  domain: string
  domainVerified: boolean
  plan: string
  tokenLimit: number | null
  tokenRemaining: number | null
  totalUsage: number | null
  createdAt: string
  firstPaidAt: string | null
  focus: string | null
  audience: string | null
  aiUser: { username: string; avatarUrl: string | null } | null
  hasActiveSubscription: boolean
}

const ROOT_DOMAINS = ['topiqu.com', 'app.topiqu.com', '127.0.0.1']

// Null on the platform's own hosts — they serve no tenant, so there is nothing to fetch, cache or refresh.
const tenantHostname = () => {
  const hostname = (useRequestURL().hostname ?? '').split(':')[0]?.replace(/^www\./, '') ?? ''
  return ROOT_DOMAINS.includes(hostname) ? null : hostname
}

const clientSiteKey = (hostname: string) => `clientsite-${hostname}`

const fetchClientSite = async () => {
  const hostname = tenantHostname()
  if (!hostname) return null

  return await useAsyncData(clientSiteKey(hostname), () => $fetch<PublicClientSite>(`/api/clients/slug/${hostname}`), {
    // A manual refresh must bypass the payload, or refreshClientSite() would keep handing back the stale copy.
    getCachedData: (key, nuxtApp, ctx) =>
      ctx.cause === 'refresh:manual' ? undefined : (nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]),
  })
}

export const useClientSite = async () => (await fetchClientSite())?.data.value ?? null

/** The same entry read as a ref, for surfaces that must follow a settings save without a reload. */
export const useLiveClientSite = async () => (await fetchClientSite())?.data ?? shallowRef(null)

export const refreshClientSite = async () => {
  const hostname = tenantHostname()
  if (hostname) await refreshNuxtData(clientSiteKey(hostname))
}

export const useClientSiteStatus = () => {
  const requestFetch = useRequestFetch()

  return useAsyncData('clientsite-status', () => requestFetch<ClientSiteStatus | null>('/api/clients/status'))
}
