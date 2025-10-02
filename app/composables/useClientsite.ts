export const useClientsite = async () => {
  const hostname = import.meta.client ? window.location.hostname : null

  if (!hostname) return null

  const { data } = await useAsyncData(`clientsite-${hostname}`, () => $fetch(`/api/clients/slug/${hostname}`))
  return data
}
