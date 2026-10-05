import type { H3Event } from 'h3'

import crypto from 'crypto'
import { isIP } from 'node:net'

const CHALLENGE_TTL_MS = 5 * 60 * 1000
const VERIFIED_TTL_MS = 30 * 60 * 1000

const getSecret = () => {
  const secret = useRuntimeConfig().auth?.secret || process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return secret as string
}

const sign = (payload: string) => {
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

const verify = (token: string): Record<string, any> | null => {
  const [b64, sig] = token.split('.')
  if (!b64 || !sig) return null
  const payload = Buffer.from(b64, 'base64url').toString('utf8')
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  if (sig.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

const hashCode = (email: string, code: string) =>
  crypto.createHmac('sha256', getSecret()).update(`${email.toLowerCase()}:${code}`).digest('hex')

export const issueChallenge = (email: string, code: string) => {
  const payload = JSON.stringify({
    t: 'challenge',
    e: email.toLowerCase(),
    h: hashCode(email, code),
    exp: Date.now() + CHALLENGE_TTL_MS,
  })
  return sign(payload)
}

export const consumeChallenge = (
  challenge: string,
  email: string,
  code: string,
): { ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'mismatch' } => {
  const data = verify(challenge)
  if (!data || data.t !== 'challenge') return { ok: false, reason: 'invalid' }
  if (typeof data.exp !== 'number' || data.exp < Date.now()) return { ok: false, reason: 'expired' }
  if (data.e !== email.toLowerCase()) return { ok: false, reason: 'invalid' }
  if (data.h !== hashCode(email, code)) return { ok: false, reason: 'mismatch' }
  return { ok: true }
}

export const issueVerifiedToken = (email: string) => {
  const payload = JSON.stringify({
    t: 'verified',
    e: email.toLowerCase(),
    exp: Date.now() + VERIFIED_TTL_MS,
  })
  return sign(payload)
}

export const verifyVerifiedToken = (token: string, email: string): boolean => {
  const data = verify(token)
  if (!data || data.t !== 'verified') return false
  if (typeof data.exp !== 'number' || data.exp < Date.now()) return false
  return data.e === email.toLowerCase()
}

const LANDING_SIG_MAX_SKEW_MS = 5 * 60 * 1000

/** The landing calls checkout server-to-server, so the visitor's IP only arrives in its signed header. */
export const landingClientIp = (event: H3Event): string | null => {
  const ip = getHeader(event, 'x-landing-client-ip')?.trim()
  const timestamp = getHeader(event, 'x-landing-timestamp')
  const sig = getHeader(event, 'x-landing-sig')
  if (!ip || !isIP(ip) || !timestamp || !sig) return null
  if (!(Math.abs(Date.now() - Number(timestamp)) <= LANDING_SIG_MAX_SKEW_MS)) return null
  // Non-hex input decodes to a shorter buffer, which timingSafeEqual throws on.
  if (!/^[0-9a-f]{64}$/.test(sig)) return null
  const expected = crypto.createHmac('sha256', getSecret()).update(`${timestamp}.${ip}`).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')) ? ip : null
}
