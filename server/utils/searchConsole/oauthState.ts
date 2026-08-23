import { createHmac, timingSafeEqual } from 'node:crypto'

interface StatePayload {
  clientSiteId: string
  nonce: string
  exp: number
  /** Carried across the hop: the callback runs on app.topiqu.com, where the tenant's `i18n_lang` cookie is not readable. */
  locale?: 'cs' | 'en'
}
const secret = () => process.env.AUTH_SECRET || process.env.NUXT_AUTH_SECRET || ''

export const signSearchConsoleState = (payload: StatePayload): string => {
  if (!secret()) throw new Error('AUTH_SECRET is not configured')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`
}

export const verifySearchConsoleState = (value: string | undefined): StatePayload | null => {
  if (!value || !secret()) return null
  const [body, signature] = value.split('.')
  if (!body || !signature) return null
  const expected = createHmac('sha256', secret()).update(body).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as StatePayload
  if (!payload.clientSiteId || payload.exp <= Date.now()) return null
  // Signed or not, the locale ends up as a path segment — whitelist it.
  return { ...payload, locale: payload.locale === 'cs' ? 'cs' : 'en' }
}
