import { createHmac, timingSafeEqual } from 'node:crypto'

export interface OAuthStatePayload {
  nonce: string
  clientSiteId: string
  appType: 'personal' | 'pages'
}

function secret() {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is not configured')
  return s
}

export function signOAuthState(payload: OAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyOAuthState(state: string | undefined): OAuthStatePayload | null {
  if (!state) return null

  const [body, sig] = state.split('.')
  if (!body || !sig) return null

  const expected = createHmac('sha256', secret()).update(body).digest('base64url')
  const provided = Buffer.from(sig)
  const wanted = Buffer.from(expected)
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as OAuthStatePayload
    if (!payload.clientSiteId || (payload.appType !== 'personal' && payload.appType !== 'pages')) {
      return null
    }
    return payload
  } catch {
    return null
  }
}
