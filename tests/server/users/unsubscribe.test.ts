import { beforeAll, describe, expect, it, vi } from 'vitest'

import { isUnsubscribeToken, unsubscribeUrl } from '../../../server/utils/unsubscribe'

beforeAll(() => vi.stubEnv('AUTH_SECRET', 'test-secret'))

const tokenOf = (url: string) => new URL(url).searchParams.get('t')!

describe('unsubscribe links', () => {
  it('builds a locale-prefixed link that carries no email address', () => {
    const url = unsubscribeUrl({ id: 'user-1', language: 'cs' }, 'https://app.test')

    expect(url.startsWith('https://app.test/cs/unsubscribe?u=user-1&t=')).toBe(true)
    expect(url).not.toContain('@')
  })

  it('uses the tenant origin when given', () => {
    expect(unsubscribeUrl({ id: 'user-1', language: 'en' }, 'https://blog.test')).toMatch(/^https:\/\/blog\.test\/en\//)
  })

  it('accepts only the token signed for that user', () => {
    const token = tokenOf(unsubscribeUrl({ id: 'user-1', language: 'en' }, 'https://app.test'))

    expect(isUnsubscribeToken('user-1', token)).toBe(true)
    expect(isUnsubscribeToken('user-2', token)).toBe(false)
    expect(isUnsubscribeToken('user-1', `${token.slice(0, -1)}x`)).toBe(false)
    expect(isUnsubscribeToken('user-1', 'short')).toBe(false)
  })
})
