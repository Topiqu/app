// SSRF guard for server-side outbound fetches. Centralized so every feature
// that fetches a user-supplied URL (image proxy now, imports later) shares one
// allowlist instead of re-implementing validation.

// Mirrors `image.domains` in nuxt.config.ts. Extend here as new sources appear.
export const ALLOWED_IMAGE_HOSTS = new Set([
  'cdn.topiqu.com',
  'topiqu-storage-eu-frankfurt.s3.eu-central-1.amazonaws.com',
  'wsrv.nl',
])

/**
 * Validates a user-supplied URL before the server fetches it. Allows only https
 * on the default port to a host in the allowlist; throws an H3 error otherwise.
 * Returns the parsed URL so callers can pass it straight to fetch().
 */
export function assertAllowedUrl(input: string, allowlist: Set<string> = ALLOWED_IMAGE_HOSTS): URL {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL' })
  }

  if (parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Only https URLs are allowed' })
  }
  if (parsed.port && parsed.port !== '443') {
    throw createError({ statusCode: 400, statusMessage: 'Non-standard port not allowed' })
  }
  if (!allowlist.has(parsed.hostname)) {
    throw createError({ statusCode: 403, statusMessage: 'Host not allowed' })
  }

  return parsed
}
