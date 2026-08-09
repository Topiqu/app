/**
 * Wikimedia blocks generic user agents outright and both APIs ask for a contact URL, so every
 * request out of this folder identifies the deployment it came from.
 */
export const imageApiHeaders = (extra?: Record<string, string>) => ({
  'User-Agent': `Topiqu/1.0 (https://${process.env.BASE_DOMAIN || 'topiqu.com'})`,
  Accept: 'application/json',
  ...extra,
})

/** One slow library must not hold up the whole article. */
export const fetchJson = async (url: URL | string, init?: RequestInit) => {
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000), ...init })

  if (!response.ok) throw new Error(`${response.status} ${await response.text().catch(() => '')}`.trim())

  return response.json()
}
