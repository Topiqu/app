export const WEBHOOK_EVENTS = ['ARTICLE_PUBLISHED', 'ARTICLE_UPDATED', 'ARTICLE_UNPUBLISHED', 'ARTICLE_DELETED'] as const
export type WebhookEventCode = (typeof WEBHOOK_EVENTS)[number]

export const MAX_WEBHOOKS = 5

/** The `type` a receiver switches on: `ARTICLE_PUBLISHED` → `article.published`. */
export const webhookEventType = (event: WebhookEventCode) => event.toLowerCase().replace('_', '.')

/** Shape check only; the server also resolves the host and refuses private addresses. */
export const webhookUrlError = (value: string): 'invalid' | 'https' | 'host' | null => {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return 'invalid'
  }
  if (url.protocol !== 'https:') return 'https'
  if (url.username || url.password || url.port || value.length > 2048) return 'invalid'
  const host = url.hostname
  const isIp = host.startsWith('[') || /^\d+(\.\d+){3}$/.test(host)
  if (!host.includes('.') || isIp || /(^|\.)(localhost|local|internal|home|test|invalid|example)$/i.test(host))
    return 'host'
  return null
}
