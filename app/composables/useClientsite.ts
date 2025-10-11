export const useClientSite = async () => {
  const hostname = import.meta.client
    ? useBrowserLocation().value.hostname?.split('.')[0]
    : (useNuxtApp().ssrContext?.event.node.req.headers.host?.split('.')[0] ?? '')
  if (!hostname) return null
  const { data } = await useAsyncData(`clientsite-${hostname}`, () => $fetch(`/api/clients/slug/${hostname}`))

  return data.value
}
