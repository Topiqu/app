export const isCdnImageUrl = (url?: string | null): boolean => {
  if (!url) return true
  try {
    const cdn = new URL(useRuntimeConfig().public.cdnUrl)
    const u = new URL(url, cdn)
    return u.protocol === 'https:' && u.host === cdn.host
  } catch {
    return false
  }
}

// Stock covers stay on their source host; one is accepted only as the tenant media asset it was registered as.
export const isCoverImageUrl = (url?: string | null, media?: { url: string; deliveryUrl: string | null } | null) =>
  isCdnImageUrl(url) || Boolean(url && media && (url === media.url || url === media.deliveryUrl))
