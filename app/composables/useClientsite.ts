import type { ClientSite } from '@prisma/client'

declare global {
  var gtagInit: boolean | undefined
}

export const useClientSite = async () => {
  if (import.meta.client && globalThis.gtagInit === undefined) globalThis.gtagInit = false

  const raw = useRequestURL().hostname ?? ''
  const hostname = raw?.split(':')[0]?.replace(/^www\./, '')

  const ROOT_DOMAINS = ['topiqu.com']

  if (ROOT_DOMAINS.includes(hostname ?? '')) {
    return null
  }

  const { data } = await useAsyncData(
    `clientsite-${hostname}`,
    () => $fetch<ClientSite>(`/api/clients/slug/${hostname}` as string),
    {
      getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
    },
  )

  const gtagId = data.value?.gtagId

  if (import.meta.client && data.value?.plan !== 'BASIC' && gtagId && data.value?.allowGtag && !globalThis.gtagInit) {
    const { initialize } = useGtag()
    initialize(gtagId)
    globalThis.gtagInit = true
  }

  return data.value
}
