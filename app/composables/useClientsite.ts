export const useClientsite = async () => {
  let hostname: string | undefined = ''
  if (import.meta.client) {
    hostname = window.location.hostname.split('.')[0]
  } else {
    const host = useNuxtApp().ssrContext?.event.node.req.headers.host
    hostname = host ? host.split('.')[0] : ''
  }
  // hostname = 'GameDev'
  if (!hostname) return null

  const { data } = await useAsyncData(`clientsite-${hostname}`, () => $fetch(`/api/clients/slug/${hostname}`))

  return data.value
}
