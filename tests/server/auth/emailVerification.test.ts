import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  allowEmailVerificationRequest,
  emailVerificationHash,
  emailVerificationMatches,
  RESEND_THROTTLE_MS,
  shouldIssueVerificationCode,
  VERIFICATION_CODE_TTL_MS,
} from '../../../server/utils/emailVerification'

const NOW = new Date('2026-08-06T12:00:00Z').getTime()
const ago = (ms: number) => new Date(NOW - ms)

describe('email verification secrets and budgets', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'isolated-email-verification-unit-test-pepper')
    vi.stubGlobal('ipKey', () => 'test-ip-fingerprint')
    vi.stubGlobal('consumeRateLimit', vi.fn().mockResolvedValue(true))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  const verification = (code: string) => ({ code, createdAt: ago(1_000), expiresAt: new Date(NOW + 1_000) })

  it('binds a constant-size hash to the canonical account email, user and code', () => {
    const stored = emailVerificationHash('user-1', ' Client@Example.COM ', 'AABBCCDD')
    expect(/^h1:[a-f0-9]{64}$/.test(stored)).toBe(true)
    expect(stored.includes('aabbccdd')).toBe(false)
    expect(emailVerificationMatches(verification(stored), 'user-1', 'client@example.com', 'aabbccdd', NOW)).toBe(true)
    expect(emailVerificationMatches(verification(stored), 'user-2', 'client@example.com', 'aabbccdd', NOW)).toBe(false)
    expect(emailVerificationMatches(verification(stored), 'user-1', 'changed@example.com', 'aabbccdd', NOW)).toBe(false)
    expect(emailVerificationMatches(verification(stored), 'user-1', 'client@example.com', '11223344', NOW)).toBe(false)
    vi.stubEnv('AUTH_SECRET', 'a-different-isolated-pepper')
    expect(emailVerificationMatches(verification(stored), 'user-1', 'client@example.com', 'aabbccdd', NOW)).toBe(false)
  })

  it('preserves valid legacy codes without extending expiry or accepting malformed/future values', () => {
    expect(emailVerificationMatches(verification('aabbccdd'), 'user-1', 'client@example.com', 'AABBCCDD', NOW)).toBe(
      true,
    )
    for (const candidate of [
      { ...verification('aabbccdd'), expiresAt: new Date(NOW) },
      { ...verification('aabbccdd'), createdAt: ago(VERIFICATION_CODE_TTL_MS) },
      { ...verification('aabbccdd'), createdAt: new Date(NOW + 1) },
      verification('invalid'),
      verification('h1:invalid'),
    ])
      expect(emailVerificationMatches(candidate, 'user-1', 'client@example.com', 'aabbccdd', NOW)).toBe(false)
  })

  it('fails closed when the HMAC pepper is missing', () => {
    vi.stubEnv('AUTH_SECRET', '')
    expect(() => emailVerificationHash('user-1', 'client@example.com', 'aabbccdd')).toThrow('AUTH_SECRET is required')
  })

  it('uses shared, opaque account and IP budgets for all issuance entry points', async () => {
    expect(await allowEmailVerificationRequest({} as never, ' Client@Example.COM ', 'issue')).toBe(true)
    const first = vi.mocked(consumeRateLimit).mock.calls.map(([key]) => key)
    vi.mocked(consumeRateLimit).mockClear()
    expect(await allowEmailVerificationRequest({} as never, 'client@example.com', 'issue')).toBe(true)
    expect(vi.mocked(consumeRateLimit).mock.calls.map(([key]) => key)).toEqual(first)
    expect(first).toHaveLength(2)
    expect(first.join(' ')).not.toContain('client@example.com')
    vi.mocked(consumeRateLimit).mockResolvedValue(false)
    expect(await allowEmailVerificationRequest({} as never, 'client@example.com', 'verify')).toBe(false)
  })
})

describe('shouldIssueVerificationCode', () => {
  it('issues a code for an unverified user who never had one', () => {
    expect(shouldIssueVerificationCode({ emailVerified: false, verification: null }, NOW)).toBe(true)
  })

  it('reissues once the throttle window has passed', () => {
    const user = { emailVerified: false, verification: { createdAt: ago(RESEND_THROTTLE_MS) } }
    expect(shouldIssueVerificationCode(user, NOW)).toBe(true)
  })

  it('throttles a rapid second request', () => {
    const user = { emailVerified: false, verification: { createdAt: ago(RESEND_THROTTLE_MS - 1) } }
    expect(shouldIssueVerificationCode(user, NOW)).toBe(false)
  })

  it('never issues for an already verified user', () => {
    expect(shouldIssueVerificationCode({ emailVerified: true, verification: null }, NOW)).toBe(false)
  })

  it('never issues for an unknown email, so the endpoint cannot enumerate accounts', () => {
    expect(shouldIssueVerificationCode(null, NOW)).toBe(false)
  })
})

describe('unverified accounts cannot sign in with a password', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

  it('rejects at the credentials sign-in boundary, after the password is proven', () => {
    const code = source('server/utils/auth.ts')
    const passwordCheck = code.indexOf('await argon.verify(user.password, parsed.data.password)')
    const verifiedCheck = code.indexOf("failure === 'email_unverified'")

    expect(passwordCheck).toBeGreaterThan(-1)
    expect(verifiedCheck).toBeGreaterThan(passwordCheck)
  })

  it('selects emailVerified so the guard cannot read undefined', () => {
    expect(source('server/utils/auth.ts')).toContain('emailVerified: true }')
  })

  it('rejects at the totp pre-flight with a machine-readable code', () => {
    const code = source('server/api/users/totp.post.ts')

    expect(code).toContain("failure !== 'email_unverified'")
    expect(code).toContain("code: 'email_not_verified'")
    expect(code).toMatch(/statusCode:\s*403/)
  })

  it('keeps the pre-flight and authorize() in sync on soft-deleted accounts', () => {
    expect(source('server/api/users/totp.post.ts')).toContain("mode: 'insensitive' }, deletedAt: null")
  })
})

describe('the resend endpoint is safe to expose unauthenticated', () => {
  const source = readFileSync(resolve(process.cwd(), 'server/api/auth/resend-verification.post.ts'), 'utf8')

  it('never resolves a session, so a locked-out user can reach it', () => {
    expect(source).not.toContain('getSessionUser')
    expect(source).not.toContain('requireUser')
  })

  it('returns the same success shape whatever the outcome', () => {
    expect(source.match(/return \{ success: true/g)).toHaveLength(1)
    expect(source).not.toMatch(/statusCode:\s*40[134]/)
  })

  it('uses the same budgeted, atomic issuer as registration and the authenticated send path', () => {
    for (const path of [
      'server/api/auth/resend-verification.post.ts',
      'server/api/auth/register.post.ts',
      'server/api/users/send-verification.post.ts',
    ]) {
      const route = readFileSync(resolve(process.cwd(), path), 'utf8')
      expect(route).toContain('allowEmailVerificationRequest(')
      expect(route).toContain('issueEmailVerification(')
    }
  })

  it('excludes soft-deleted accounts', () => {
    expect(readFileSync(resolve(process.cwd(), 'server/utils/emailVerification.ts'), 'utf8')).toContain(
      'deletedAt: null',
    )
  })
})
