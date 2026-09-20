import type { TrialState } from '~~/shared/utils/trial'
import type { PublicClientSite } from '~~/shared/utils/clientSiteFields'

export interface ClientSiteStatus {
  id: string
  name: string
  language: 'cs' | 'en'
  domain: string
  domainVerified: boolean
  plan: string
  articleWallet: {
    available: number
    reserved: number
    balance: number
    grants: { id: string; remaining: number; expiresAt: string | null; periodEnd: string | null; source: string }[]
  }
  articlesRemaining: number
  createdAt: string
  firstPaidAt: string | null
  trial: {
    state: TrialState
    endsAt: string | null
    daysLeft: number
  }
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

/** Refreshes the shared status ref used by the editor, navigation and article balance surfaces. */
export const refreshClientSiteStatus = () => refreshNuxtData('clientsite-status')

/** Replaces the shared shallow status value so every mounted balance surface reacts immediately. */
export const patchClientSiteArticleWallet = (patch: { available: number; reserved?: number; balance?: number }) => {
  const status = useNuxtData<ClientSiteStatus | null>('clientsite-status')
  if (!status.data.value) return
  status.data.value = {
    ...status.data.value,
    articlesRemaining: patch.available,
    articleWallet: {
      ...status.data.value.articleWallet,
      available: patch.available,
      reserved: patch.reserved ?? status.data.value.articleWallet.reserved,
      balance: patch.balance ?? status.data.value.articleWallet.balance,
    },
  }
}

/** Stop can close the response before the server settles its reservation. Refresh until that
 * reservation disappears instead of freezing ClientVersion on the first, racing response. */
export const refreshClientSiteStatusAfterStop = async (reservedBefore: number) => {
  for (let attempt = 0; attempt < 12; attempt++) {
    await refreshClientSiteStatus()
    const status = useNuxtData<ClientSiteStatus | null>('clientsite-status').data.value
    if (!status || status.articleWallet.reserved <= reservedBefore) return
    await new Promise((resolve) => setTimeout(resolve, 250 * Math.min(attempt + 1, 4)))
  }
}
