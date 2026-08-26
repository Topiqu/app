// Single source of truth for the hosts we trust to serve images. Consumed by
// `image.domains` in nuxt.config.ts (for @nuxt/image) and by the SSRF guard in
// server/utils/ssrf.ts, so the allowlist can never drift between the two.
export const IMAGE_HOSTS = [
  'cdn.topiqu.com',
  'topiqu-storage-eu-frankfurt.s3.eu-central-1.amazonaws.com',
  'wsrv.nl',
] as const

/** Only route stable, public image URLs through Nuxt Image/IPX. */
export const canOptimizeImageUrl = (value: string) => {
  if (!value || value.startsWith('//') || value.startsWith('/api/')) return false
  if (value.startsWith('/')) return true

  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    if (!IMAGE_HOSTS.includes(url.hostname as (typeof IMAGE_HOSTS)[number])) return false

    return ![...url.searchParams.keys()].some((key) => /^(?:signature|sig|token|x-amz-|expires|auth)/i.test(key))
  } catch {
    return false
  }
}
