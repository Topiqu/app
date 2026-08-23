import type { PublicClientSite } from '~~/shared/utils/clientSiteFields'

declare global {
  var gtagInit: boolean | undefined
}

export interface ClientSiteStatus {
  id: string
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
  if (import.meta.client && globalThis.gtagInit === undefined) globalThis.gtagInit = false

  const raw = useRequestURL().hostname ?? ''
  const hostname = raw?.split(':')[0]?.replace(/^www\./, '')

  const ROOT_DOMAINS = ['topiqu.com', 'app.topiqu.com', '127.0.0.1']

  if (ROOT_DOMAINS.includes(hostname ?? '')) {
    return null
  }

  // Resolved before the await: `admin` middleware calls this, and a composable that reaches for
  // the Nuxt instance past an await point there throws on SSR (`experimental.asyncContext` is off).
  const gtag = import.meta.client ? useGtag() : null

  const { data } = await useAsyncData(
    `clientsite-${hostname}`,
    () => $fetch<PublicClientSite>(`/api/clients/slug/${hostname}` as string),
    {
      getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
    },
  )

  const gtagId = data.value?.gtagId

  if (gtag && data.value?.plan !== 'BASIC' && gtagId && data.value?.allowGtag && !globalThis.gtagInit) {
    gtag.initialize(gtagId)
    globalThis.gtagInit = true
  }

  return data.value
}

export const useClientSiteStatus = () => {
  const requestFetch = useRequestFetch()

  return useAsyncData('clientsite-status', () => requestFetch<ClientSiteStatus | null>('/api/clients/status'))
}
