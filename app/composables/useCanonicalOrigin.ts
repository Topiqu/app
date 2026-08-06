import { buildCanonicalOrigin } from '~~/shared/utils/seo'

export const useCanonicalOrigin = () => {
  const url = useRequestURL()
  return buildCanonicalOrigin(url.protocol, url.host, import.meta.dev)
}
