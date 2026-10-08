import { authenticator } from 'otplib'
import { createHmac, timingSafeEqual } from 'node:crypto'

const LOGIN_TTL_MS = 5 * 60 * 1000
const SETUP_TTL_MS = 10 * 60 * 1000

type Purpose = 'login' | 'setup'
type Claims = { purpose: Purpose; userId: string; exp: number; secret?: string }

const b64u = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

const b64uDecode = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4), 'base64')

const getSecret = () => {
  const secret = useRuntimeConfig().auth.secret
  if (!secret) throw createError({ statusCode: 500, message: 'AUTH_SECRET is not configured' })
  return secret
}

const hmac = (payload: string) => b64u(createHmac('sha256', getSecret()).update(payload).digest())

const sign = (claims: Omit<Claims, 'exp'>, ttl: number) => {
  const payload = b64u(JSON.stringify({ ...claims, exp: Date.now() + ttl }))
  return `${payload}.${hmac(payload)}`
}

// `purpose` keeps a setup token from passing as a login challenge and vice versa.
const read = (token: string, purpose: Purpose, userId?: string): Claims => {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) throw createError({ statusCode: 400, message: 'Invalid challenge' })

  const a = Buffer.from(sig)
  const b = Buffer.from(hmac(payload))
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw createError({ statusCode: 401, message: 'Invalid challenge' })

  const claims = JSON.parse(b64uDecode(payload).toString('utf8')) as Claims
  if (claims.purpose !== purpose || !claims.userId || (userId && claims.userId !== userId))
    throw createError({ statusCode: 401, message: 'Invalid challenge' })
  if (typeof claims.exp !== 'number' || Date.now() > claims.exp)
    throw createError({ statusCode: 401, message: 'Challenge expired' })

  return claims
}

export const signTotpChallenge = (userId: string) => sign({ purpose: 'login', userId }, LOGIN_TTL_MS)

export const verifyTotpChallenge = (challenge: string): { userId: string } => ({
  userId: read(challenge, 'login').userId,
})

// The pending secret rides in the token, not the row: a stored but unconfirmed secret already gates login.
export const signTotpSetup = (userId: string, secret: string) => sign({ purpose: 'setup', userId, secret }, SETUP_TTL_MS)

export const verifyTotpSetup = (token: string, userId: string): string => {
  const { secret } = read(token, 'setup', userId)
  if (!secret) throw createError({ statusCode: 401, message: 'Invalid challenge' })
  return secret
}

// Six digits fall to brute force without a cap. Every attempt counts, so a correct guess is not free either.
export const checkTotpCode = async (userId: string, secret: string | null | undefined, code: string | undefined) => {
  if (!(await consumeRateLimit(`totp:${userId}`, 10, 15 * 60))) return 'limited' as const
  const token = code?.replace(/\s/g, '')
  return secret && token && authenticator.verify({ token, secret }) ? ('ok' as const) : ('invalid' as const)
}
