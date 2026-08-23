import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('legacy invitation URL middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRequestURL', () => new URL('https://tenant.topiqu.com/invitation/raw-token?source=email'))
    vi.stubGlobal('invitationTokenHash', () => 'token-hash')
  })

  it.each([
    ['cs', '/cs/invitation/raw-token?source=email'],
    ['en', '/en/invitation/raw-token?source=email'],
  ])('redirects an existing %s invitation before Nuxt routing', async (language, expected) => {
    vi.stubGlobal('prisma', {
      tenantInvitation: { findUnique: vi.fn().mockResolvedValue({ clientSite: { language } }) },
    })
    const redirect = vi.fn().mockReturnValue('redirected')
    vi.stubGlobal('sendRedirect', redirect)
    const handler = (await import('../../../server/middleware/invitationLocale')).default

    await expect(handler({} as never)).resolves.toBe('redirected')
    expect(redirect).toHaveBeenCalledWith({}, expected, 302)
  })
})
