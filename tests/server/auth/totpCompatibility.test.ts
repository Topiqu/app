import { generateSecret, generateSync } from 'otplib'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { verifyTotpToken } from '../../../server/utils/totp'

afterEach(() => vi.useRealTimers())

describe('authenticator compatibility across library upgrades', () => {
  it('accepts an existing 80-bit v12 account secret and its recorded token', () => {
    vi.useFakeTimers().setSystemTime(1_234_567_890_000)
    // Recorded with the previous v12 authenticator at this fixed epoch.
    expect(verifyTotpToken('JBSWY3DPEHPK3PXP', '742275')).toBe(true)
    vi.advanceTimersByTime(30_000)
    expect(verifyTotpToken('JBSWY3DPEHPK3PXP', '742275')).toBe(false)
  })

  it('matches the RFC6238 SHA1 vector with six digits and no extra clock window', () => {
    vi.useFakeTimers().setSystemTime(59_000)
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    expect(verifyTotpToken(secret, '287082')).toBe(true)
    vi.setSystemTime(89_000)
    expect(verifyTotpToken(secret, '287082')).toBe(false)
  })

  it('generates stronger new secrets without changing the six-digit app contract', () => {
    const secret = generateSecret()
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    const code = generateSync({ secret })
    expect(code).toMatch(/^\d{6}$/)
    expect(verifyTotpToken(secret, code)).toBe(true)
  })

  it.each(['', 'bad-secret!', 'ABC', 'A'.repeat(5000)])('rejects corrupt stored secrets safely', (secret) => {
    expect(verifyTotpToken(secret, '123456')).toBe(false)
  })

  it.each(['', '12', '1234567', 'ABCDEF', '123 45', '１２３４５６'])('rejects malformed codes: %s', (code) => {
    expect(verifyTotpToken('JBSWY3DPEHPK3PXP', code)).toBe(false)
  })
})
