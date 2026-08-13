const CALLBACK_PATH = '/api/linkedin/callback'

export function getLinkedInRedirectUri(): string {
  const configuredOrigin = process.env.APP_URL

  if (!configuredOrigin) {
    if (process.env.NODE_ENV !== 'production') return `http://localhost:3000${CALLBACK_PATH}`
    throw new Error('APP_URL is required for LinkedIn OAuth in production')
  }

  const origin = new URL(configuredOrigin)
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('APP_URL must use http or https')

  return new URL(CALLBACK_PATH, origin.origin).toString()
}
