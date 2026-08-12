import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { credentialFailure, loginRequestContext, normalizeLoginEmail } from '../../../server/utils/authLogin'

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
          'x-forwarded-for': '203.0.113.4, 10.0.0.2',
          'user-agent': 'Browser',
        },
      } as any,
      'client@example.com',
    )
    expect(context).toMatchObject({ ip: '203.0.113.4', host: 'tenant.example.com', userAgent: 'Browser' })
    expect(JSON.stringify(context)).not.toContain('client@example.com')
  })
})

describe('credential login wiring', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

  it('limits and logs both the public preflight and direct authorize endpoint', () => {
    for (const path of ['server/api/users/totp.post.ts', 'server/api/auth/[...].ts']) {
      const code = source(path)
      expect(code).toContain('checkLoginRateLimit')
      expect(code).toContain('logLoginFailure')
      expect(code).toContain("mode: 'insensitive'")
    }
  })

  it('records success and lastLogin only at the server authentication boundary', () => {
    const auth = source('server/api/auth/[...].ts')
    const form = source('app/components/Auth/Form.vue')
    expect(auth).toContain('data: { lastLogin: new Date() }')
    expect(auth).toContain('logLoginSuccess')
    expect(form).not.toContain('lastLogin: Date.now()')
  })

  it('does not continue after NextAuth returns a failed sign-in result', () => {
    const form = source('app/components/Auth/Form.vue')
    expect(form).toContain('if (result?.error) throw createError')
    expect(form.match(/signInWithCredentials\(/g)).toHaveLength(3)
  })
})
