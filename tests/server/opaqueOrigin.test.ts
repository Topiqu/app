import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('opaque origin guard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const call = async (method: string, path: string, headers: Record<string, string>) => {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getRequestHeader', (_event: unknown, name: string) => headers[name])
    const guard = (await import('../../server/middleware/opaqueOrigin')).default as (event: unknown) => void
    return () => guard({ method, path })
  }

  it('blocks a cookie-carrying write from a sandboxed frame', async () => {
    expect(await call('POST', '/api/comments', { origin: 'null', cookie: 'session=1' })).toThrow()
  })

  it('lets reads, cookie-less calls and normal origins through', async () => {
    expect(await call('GET', '/api/comments', { origin: 'null', cookie: 'session=1' })).not.toThrow()
    expect(await call('POST', '/api/stripe/webhook', { origin: 'null' })).not.toThrow()
    expect(await call('POST', '/api/comments', { origin: 'https://blog.example.cz', cookie: 'session=1' })).not.toThrow()
  })
})
