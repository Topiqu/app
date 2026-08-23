import { afterEach, describe, expect, it, vi } from 'vitest'

import { getLinkedInRedirectUri } from '../../../server/utils/linkedin/redirectUri'

afterEach(() => vi.unstubAllEnvs())

describe('getLinkedInRedirectUri', () => {
  it('builds the callback from APP_URL', () => {
    vi.stubEnv('APP_URL', 'https://app.topiqu.com/')
    expect(getLinkedInRedirectUri()).toBe('https://app.topiqu.com/api/linkedin/callback')
  })

  it('rejects non-http origins', () => {
    vi.stubEnv('APP_URL', 'javascript:alert(1)')
    expect(() => getLinkedInRedirectUri()).toThrow('http or https')
  })
})
