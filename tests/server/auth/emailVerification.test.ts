import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { RESEND_THROTTLE_MS, shouldIssueVerificationCode } from '../../../server/utils/emailVerification'

const NOW = new Date('2026-08-06T12:00:00Z').getTime()
const ago = (ms: number) => new Date(NOW - ms)

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

  it('rejects at the authorize() boundary, after the password is proven', () => {
    const code = source('server/api/auth/[...].ts')
    const passwordCheck = code.indexOf('await argon.verify(user.password, password)')
    const verifiedCheck = code.indexOf("failure !== 'email_unverified'")

    expect(passwordCheck).toBeGreaterThan(-1)
    expect(verifiedCheck).toBeGreaterThan(passwordCheck)
  })

  it('selects emailVerified so the guard cannot read undefined', () => {
    expect(source('server/api/auth/[...].ts')).toContain('emailVerified: true,')
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
    expect(source).not.toContain('getServerSession')
    expect(source).not.toContain('requireUser')
  })

  it('returns the same success shape whatever the outcome', () => {
    expect(source.match(/return \{ success: true/g)).toHaveLength(1)
    expect(source).not.toMatch(/statusCode:\s*40[134]/)
  })

  it('gates the send behind the throttle helper', () => {
    expect(source).toContain('shouldIssueVerificationCode(user)')
  })

  it('excludes soft-deleted accounts', () => {
    expect(source).toContain('deletedAt: null')
  })
})
