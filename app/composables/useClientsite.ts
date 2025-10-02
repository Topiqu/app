export const useClientsite = () => {
  const clientsite = shallowRef<string | null>(null)

  if (import.meta.client) {
    clientsite.value = window.location.hostname
  }

  return clientsite
}
