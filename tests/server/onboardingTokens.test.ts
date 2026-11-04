// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'

import {
  consumeChallenge,
  issueChallenge,
  issueVerifiedToken,
  verifyVerifiedToken,
} from '../../server/utils/onboardingTokens'

mockNuxtImport('useRuntimeConfig', () => () => ({ auth: { secret: 'synthetic-onboarding-proof-secret' } }))

describe('onboarding email proofs', () => {
  it('rejects malformed hexadecimal signatures without throwing', () => {
    const token = issueVerifiedToken('owner@example.test')
    const [payload] = token.split('.')
    expect(verifyVerifiedToken(`${payload}.${'z'.repeat(64)}`, 'owner@example.test')).toBe(false)
    expect(consumeChallenge(`${payload}.${'z'.repeat(64)}`, 'owner@example.test', '123456')).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('binds valid proofs to their email and purpose', () => {
    const token = issueVerifiedToken('owner@example.test')
    expect(verifyVerifiedToken(token, 'owner@example.test')).toBe(true)
    expect(verifyVerifiedToken(token, 'other@example.test')).toBe(false)
    expect(verifyVerifiedToken(issueChallenge('owner@example.test', '123456'), 'owner@example.test')).toBe(false)
    expect(consumeChallenge(issueChallenge('owner@example.test', '123456'), 'owner@example.test', '123456')).toEqual({
      ok: true,
    })
  })
})
