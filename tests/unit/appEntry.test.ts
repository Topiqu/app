import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, navigateTo } = vi.hoisted(() => ({
  state: { hostname: 'app.topiqu.com', user: null as { role: string } | null },
  navigateTo: vi.fn((path: unknown) => path),
}))

mockNuxtImport('useRequestURL', () => () => ({ hostname: state.hostname }))
mockNuxtImport('useAuth', () => () => ({ data: { value: { user: state.user } } }))
mockNuxtImport('useLocalePath', () => () => (route: unknown) => route)
mockNuxtImport('navigateTo', () => navigateTo)

beforeEach(() => {
  state.hostname = 'app.topiqu.com'
  state.user = null
  navigateTo.mockClear()
})

describe('app entry routing', () => {
  const run = async (name = 'index___en', hash = '') => {
    const { default: middleware } = await import('../../app/middleware/app-entry.global')
    return middleware({ name, hash } as never, {} as never)
  }

  it('sends anonymous legacy article links to login', async () => {
    await run('index___en', '#articles')
    expect(navigateTo).toHaveBeenCalledWith({ name: 'autorizace' }, { replace: true })
  })

  it('resolves the workspace for signed-in users in both locales', async () => {
    state.user = { role: 'admin' }
    await run('index___cs')
    expect(navigateTo).toHaveBeenCalledWith({ name: 'start' }, { replace: true })
  })

  it('leaves tenant publications and marketing homepages accessible', async () => {
    for (const host of ['blog.topiqu.com', 'topiqu.com', 'example.com']) {
      state.hostname = host
      await run()
    }
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('preserves direct links to app pages', async () => {
    await run('admin-editor-id___en')
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('returns signed-in app users through workspace selection', async () => {
    state.user = { role: 'reader' }
    const { default: middleware } = await import('../../app/middleware/auth')
    await middleware({ query: {} } as never, {} as never)
    expect(navigateTo).toHaveBeenCalledWith({ name: 'start' })
  })

  it('keeps invitation acceptance ahead of the default workspace', async () => {
    state.user = { role: 'admin' }
    const { default: middleware } = await import('../../app/middleware/auth')
    await middleware({ query: { invitation: 'invite-token' } } as never, {} as never)
    expect(navigateTo).toHaveBeenCalledWith({ name: 'invitation-token', params: { token: 'invite-token' } })
  })
})
