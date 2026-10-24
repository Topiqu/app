import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ip'), 'clientIp', 'pepperIp')
}

await stubImports()

const { credentialFailure, loginRequestContext, normalizeLoginEmail, checkLoginRateLimit, logLoginFailure } =
  await import('../../../server/utils/authLogin')
const limits = vi.fn().mockResolvedValue(true)
const log = { warn: vi.fn().mockResolvedValue(undefined) }

describe('credential login decisions', () => {
  it.each([
    [null, false, 'user_not_found'],
    [{ password: null, emailVerified: true }, false, 'password_missing'],
    [{ password: 'hash', emailVerified: true }, false, 'password_mismatch'],
    [{ password: 'hash', emailVerified: false }, true, 'email_unverified'],
    [{ password: 'hash', emailVerified: true }, true, null],
  ])('maps the complete credential state to a private failure reason', (user, matches, expected) => {
    expect(credentialFailure(user, matches)).toBe(expected)
  })

  it('normalizes email before lookup and fingerprinting', () => {
    expect(normalizeLoginEmail('  Client@Example.COM ')).toBe('client@example.com')
    const req = { headers: { host: 'tenant.example.com', 'user-agent': 'Browser' } }
    expect(loginRequestContext(req as any, 'Client@Example.com').identity).toBe(
      loginRequestContext(req as any, 'client@example.COM').identity,
    )
  })

  it('extracts security context without retaining the email', () => {
    const context = loginRequestContext(
      {
        headers: {
          host: 'internal:3000',
          'x-forwarded-host': 'tenant.example.com',
          'x-forwarded-for': '172.70.240.24',
          'cf-connecting-ip': '203.0.113.4',
          'user-agent': 'Browser',
        },
      } as any,
      'client@example.com',
    )
    expect(context).toMatchObject({
      ipFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      host: 'tenant.example.com',
    })
    expect(JSON.stringify(context)).not.toMatch(/client@example\.com|203\.0\.113\.4|172\.70\.240\.24|Browser/)
  })

  it.each(['203.0.113.4', '2001:db8::1'])('keeps a stable fingerprint for %s without storing the address', (ip) => {
    const req = { headers: { 'x-forwarded-for': ip } }
    const first = loginRequestContext(req, 'client@example.test')
    expect(first.ipFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(loginRequestContext(req, 'other@example.test').ipFingerprint).toBe(first.ipFingerprint)
    expect(JSON.stringify(first)).not.toContain(ip)
  })

  it('preserves the existing rate-limit keys and thresholds using the fingerprint directly', async () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.4' } }
    const context = loginRequestContext(req, 'client@example.test')
    await checkLoginRateLimit(req, 'client@example.test', 'preflight')
    expect(limits).toHaveBeenCalledWith(`login:preflight:ip:${context.ipFingerprint}`, 30, 15 * 60)
    expect(limits).toHaveBeenCalledWith(`login:preflight:identity:${context.identity}`, 8, 15 * 60)
  })

  it('does not pass raw addresses or browser signatures to the authentication logger', async () => {
    await logLoginFailure(
      { headers: { 'x-forwarded-for': '203.0.113.4', 'user-agent': 'Synthetic Browser/123' } },
      'client@example.test',
      'password_mismatch',
      'preflight',
    )
    expect(log.warn).toHaveBeenCalledWith(
      'AUTH_LOGIN_FAILED',
      expect.objectContaining({ ipFingerprint: expect.any(String), reason: 'password_mismatch' }),
    )
    expect(JSON.stringify(log.warn.mock.calls)).not.toMatch(/203\.0\.113\.4|Synthetic Browser|client@example\.test/)
  })
})

describe('credential login wiring', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

  it('limits and logs both the public preflight and direct authorize endpoint', () => {
    for (const path of ['server/api/users/totp.post.ts', 'server/utils/auth.ts']) {
      const code = source(path)
      expect(code).toContain('checkLoginRateLimit')
      expect(code).toContain('logLoginFailure')
      expect(code).toContain("mode: 'insensitive'")
    }
  })

  it('records success and lastLogin only at the server authentication boundary', () => {
    const auth = source('server/utils/auth.ts')
    const form = source('app/components/Auth/Form.vue')
    expect(auth).toContain('data: { lastLogin: new Date() }')
    expect(auth).toContain('logLoginSuccess')
    expect(form).not.toContain('lastLogin: Date.now()')
  })

  it('does not continue after a failed sign-in', () => {
    const form = source('app/components/Auth/Form.vue')
    expect(form).toContain('throw createError({ statusCode: e?.statusCode || 401, message: $t(key) })')
    expect(form.match(/signInWithCredentials\(/g)).toHaveLength(3)
  })
})

beforeEach(async () => {
  await stubImports()
  vi.clearAllMocks()
  vi.stubEnv('AUTH_SECRET', 'synthetic-auth-secret-for-log-tests')
  vi.stubGlobal('consumeRateLimit', limits)
  vi.stubGlobal('logger', log)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
