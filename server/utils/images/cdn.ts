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
