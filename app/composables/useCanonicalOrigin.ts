export const useCanonicalOrigin = () => {
  const url = useRequestURL()
  return buildCanonicalOrigin(url.protocol, url.host, import.meta.dev)
}
