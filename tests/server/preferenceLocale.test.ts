import { createEvent, createError, getCookie, getRequestURL } from 'h3'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

let handler: typeof import('../../server/middleware/preferenceLocale').default
beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (run: unknown) => run)
  handler = (await import('../../server/middleware/preferenceLocale')).default
})
afterEach(() => vi.unstubAllGlobals())

describe('unlocalized preference entry', () => {
  const setup = (path: string, cookie?: string, language?: string) => {
    const event = createEvent(
      { url: path, method: 'GET', headers: { host: 'blog.example.test', cookie } } as never,
      {} as never,
    )
    const session = vi.fn().mockResolvedValue(language ? { language } : null)
    const redirect = vi.fn()
    vi.stubGlobal('getRequestURL', getRequestURL)
    vi.stubGlobal('getCookie', getCookie)
    vi.stubGlobal('getSessionUser', session)
    vi.stubGlobal('sendRedirect', redirect)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('setResponseHeader', vi.fn())
    vi.stubGlobal('appendResponseHeader', vi.fn())
    return { event, session, redirect }
  }
  it('prefers the authenticated account over a stale cookie and preserves the query', async () => {
    const { event, redirect } = setup('/?campaign=welcome', 'topiqu-language=en', 'cs')
    await handler(event)
    expect(redirect).toHaveBeenCalledWith(event, '/cs?campaign=welcome', 302)
  })
  it('uses the shared preference for a guest', async () => {
    const { event, redirect } = setup('/', 'topiqu-language=de')
    await handler(event)
    expect(redirect).toHaveBeenCalledWith(event, '/de', 302)
  })
  it('preserves explicit language links without a session lookup', async () => {
    const { event, session, redirect } = setup('/fr/articles/story', 'topiqu-language=cs', 'en')
    await handler(event)
    expect(session).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })
  it('ignores unsupported cookie values', async () => {
    const { event, redirect } = setup('/', 'topiqu-language=https://evil.test')
    await handler(event)
    expect(redirect).not.toHaveBeenCalled()
  })
})
