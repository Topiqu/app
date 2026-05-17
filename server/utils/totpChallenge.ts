import { createHmac, timingSafeEqual } from 'node:crypto'

const TTL_MS = 5 * 60 * 1000

const b64u = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

const b64uDecode = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4), 'base64')

const getSecret = () => {
  const secret = useRuntimeConfig().auth.secret
  if (!secret) throw createError({ statusCode: 500, message: 'AUTH_SECRET is not configured' })
  return secret
}

export const signTotpChallenge = (userId: string) => {
  const payload = b64u(JSON.stringify({ userId, exp: Date.now() + TTL_MS }))
  const sig = b64u(createHmac('sha256', getSecret()).update(payload).digest())
  return `${payload}.${sig}`
}

export const verifyTotpChallenge = (challenge: string): { userId: string } => {
  const [payload, sig] = challenge.split('.')
  if (!payload || !sig) throw createError({ statusCode: 400, message: 'Invalid challenge' })

  const expected = b64u(createHmac('sha256', getSecret()).update(payload).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw createError({ statusCode: 401, message: 'Invalid challenge' })

  const { userId, exp } = JSON.parse(b64uDecode(payload).toString('utf8')) as { userId: string; exp: number }
  if (!userId || typeof exp !== 'number' || Date.now() > exp)
    throw createError({ statusCode: 401, message: 'Challenge expired' })

  return { userId }
}
