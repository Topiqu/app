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
  hasActiveSubscription: boolean
}

export const useClientSite = async () => {
  const raw = useRequestURL().hostname ?? ''
  const hostname = raw?.split(':')[0]?.replace(/^www\./, '')

  const ROOT_DOMAINS = ['topiqu.com', 'app.topiqu.com', '127.0.0.1']

  if (ROOT_DOMAINS.includes(hostname ?? '')) {
    return null
  }

  const { data } = await useAsyncData(
    `clientsite-${hostname}`,
    () => $fetch<PublicClientSite>(`/api/clients/slug/${hostname}` as string),
    {
      getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
    },
  )

  return data.value
}

export const useClientSiteStatus = () => {
  const requestFetch = useRequestFetch()

  return useAsyncData('clientsite-status', () => requestFetch<ClientSiteStatus | null>('/api/clients/status'))
}
