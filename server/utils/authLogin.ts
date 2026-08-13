import type { RequestInternal } from 'next-auth'

import { createHmac } from 'node:crypto'

export type LoginFailure =
  | 'user_not_found'
  | 'password_missing'
  | 'password_mismatch'
  | 'email_unverified'
  | 'totp_invalid'
  | 'rate_limited'

export const credentialFailure = (
  user: { password: string | null; emailVerified: boolean } | null,
  passwordMatches: boolean,
): Exclude<LoginFailure, 'totp_invalid' | 'rate_limited'> | null => {
  if (!user) return 'user_not_found'
  if (!user.password) return 'password_missing'
  if (!passwordMatches) return 'password_mismatch'
  if (!user.emailVerified) return 'email_unverified'
  return null
}

type AuthRequest = Pick<RequestInternal, 'headers'>

export const normalizeLoginEmail = (email: string) => email.trim().toLowerCase()

const authFingerprint = (value: string) =>
  createHmac('sha256', process.env.AUTH_SECRET || 'missing-auth-secret')
    .update(value)
    .digest('hex')

const header = (req: AuthRequest, name: string) => {
  const value = req.headers?.[name]
  return Array.isArray(value) ? value[0] : value
}

export const loginRequestContext = (req: AuthRequest, email: string) => ({
  identity: authFingerprint(normalizeLoginEmail(email)),
  ip: header(req, 'x-forwarded-for')?.split(',')[0]?.trim() || header(req, 'x-real-ip') || null,
  host: header(req, 'x-forwarded-host') || header(req, 'host') || null,
  userAgent: header(req, 'user-agent') || null,
})

export async function checkLoginRateLimit(req: AuthRequest, email: string, stage: 'preflight' | 'authorize') {
  const context = loginRequestContext(req, email)
  const ipKey = context.ip ? authFingerprint(context.ip) : 'unknown'
  const [ipAllowed, identityAllowed] = await Promise.all([
    consumeRateLimit(`login:${stage}:ip:${ipKey}`, 30, 15 * 60),
    consumeRateLimit(`login:${stage}:identity:${context.identity}`, 8, 15 * 60),
  ])
  return { allowed: ipAllowed && identityAllowed, context }
}

export const logLoginFailure = async (
  req: AuthRequest,
  email: string,
  reason: LoginFailure,
  stage: 'preflight' | 'authorize',
) => {
  await logger.warn(reason === 'rate_limited' ? 'AUTH_LOGIN_RATE_LIMITED' : 'AUTH_LOGIN_FAILED', {
    source: 'auth',
    reason,
    stage,
    ...loginRequestContext(req, email),
  })
}

export const logLoginSuccess = async (req: AuthRequest, email: string, userId: string, clientSiteId: string | null) => {
  await logger.info('AUTH_LOGIN_SUCCEEDED', {
    source: 'auth',
    method: 'credentials',
    userId,
    clientSiteId,
    ...loginRequestContext(req, email),
  })
}
