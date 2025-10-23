declare global {
  var gtagInit: boolean | undefined
}

export const useClientSite = async () => {
  if (import.meta.client && globalThis.gtagInit === undefined) globalThis.gtagInit = false

  const hostname = import.meta.client
    ? useBrowserLocation().value.hostname?.replace('www.', '').split(':')[0]
    : (useNuxtApp().ssrContext?.event.node.req.headers.host?.replace('www.', '').split(':')[0] ?? '')

  if (!hostname) return

  const { data } = await useAsyncData(`clientsite-${hostname}`, () => $fetch(`/api/clients/slug/${hostname}`))
  const gtagId = data.value?.gtagId

  if (import.meta.client && data.value?.plan !== 'BASIC' && gtagId && !globalThis.gtagInit) {
    const { initialize } = useGtag()
    initialize(gtagId)
    globalThis.gtagInit = true
  }

  return data.value
}
