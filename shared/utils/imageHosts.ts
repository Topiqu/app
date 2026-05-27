// Single source of truth for the hosts we trust to serve images. Consumed by
// `image.domains` in nuxt.config.ts (for @nuxt/image) and by the SSRF guard in
// server/utils/ssrf.ts, so the allowlist can never drift between the two.
export const IMAGE_HOSTS = [
  'cdn.topiqu.com',
  'topiqu-storage-eu-frankfurt.s3.eu-central-1.amazonaws.com',
  'wsrv.nl',
] as const
