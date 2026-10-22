import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { billingReturnUrl } from '../../server/utils/billingOrigin'

let cookie: string | undefined
beforeEach(() => {
  cookie = undefined
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('getRequestURL', () => new URL('https://blog.example.test/api/stripe/portal'))
  vi.stubGlobal('getCookie', () => cookie)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
})
afterEach(() => vi.unstubAllGlobals())

describe('Stripe billing return URLs', () => {
  it.each(['cs', 'en', 'de', 'fr'])('returns to the supported %s settings route', async (locale) => {
    await expect(billingReturnUrl({} as never, 'https://blog.example.test', locale)).resolves.toBe(
      `https://blog.example.test/${locale}/settings?tab=billing`,
    )
  })
  it('supports older clients using their cookie, then account preference, then English', async () => {
    cookie = 'cs'
    await expect(billingReturnUrl({} as never, 'https://blog.example.test', undefined, 'fr')).resolves.toContain(
      '/cs/settings?tab=billing',
    )
    cookie = 'unsupported'
    await expect(billingReturnUrl({} as never, 'https://blog.example.test', undefined, 'fr')).resolves.toContain(
      '/fr/settings?tab=billing',
    )
    await expect(billingReturnUrl({} as never, 'https://blog.example.test')).resolves.toContain(
      '/en/settings?tab=billing',
    )
  })
  it.each(['../evil', '//evil.example', 'xx', null])('rejects an explicit invalid locale: %s', async (locale) => {
    await expect(billingReturnUrl({} as never, 'https://blog.example.test', locale)).rejects.toMatchObject({
      statusCode: 400,
    })
  })
  it('rejects a different return origin before creating a Stripe redirect', async () => {
    await expect(billingReturnUrl({} as never, 'https://evil.example', 'cs')).rejects.toMatchObject({ statusCode: 400 })
  })
})
