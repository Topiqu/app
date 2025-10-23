declare global {
  var gtagInit: boolean | undefined
}

export const useClientSite = async () => {
  if (import.meta.client && globalThis.gtagInit === undefined) globalThis.gtagInit = false

  const raw = useRequestURL().hostname ?? ''

  const hostname = raw?.split(':')[0]?.replace(/^www\./, '')

  const { data } = await useAsyncData(`clientsite-${hostname}`, () => $fetch(`/api/clients/slug/${hostname}`))

  const gtagId = data.value?.gtagId

  if (import.meta.client && data.value?.plan !== 'BASIC' && gtagId && !globalThis.gtagInit) {
    const { initialize } = useGtag()
    initialize(gtagId)
    globalThis.gtagInit = true
  }

  return data.value
}
