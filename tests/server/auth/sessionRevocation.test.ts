import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { findSessionCookies, isSessionActive, stripCookie } from '../../../server/utils/sessionGuard'

const BASE = 'next-auth.session-token'

const makeDb = (row: { revoked: boolean; deletedAt: Date | null } | null) => ({
  session: { findFirst: vi.fn(async () => row) },
})

describe('isSessionActive', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts a live session', async () => {
    const db = makeDb({ revoked: false, deletedAt: null })
    await expect(isSessionActive(db, 's1', 'u1')).resolves.toBe(true)
  })

  it('rejects a revoked session', async () => {
    const db = makeDb({ revoked: true, deletedAt: null })
    await expect(isSessionActive(db, 's1', 'u1')).resolves.toBe(false)
  })

  it('rejects a soft-deleted session', async () => {
    const db = makeDb({ revoked: false, deletedAt: new Date() })
    await expect(isSessionActive(db, 's1', 'u1')).resolves.toBe(false)
  })

  it('rejects a session that does not exist', async () => {
    const db = makeDb(null)
    await expect(isSessionActive(db, 's1', 'u1')).resolves.toBe(false)
  })

  it('scopes the lookup to the owner, never to the session id alone', async () => {
    const db = makeDb({ revoked: false, deletedAt: null })
    await isSessionActive(db, 's1', 'u1')

    expect(db.session.findFirst).toHaveBeenCalledWith({
      where: { id: 's1', userId: 'u1' },
      select: { revoked: true, deletedAt: true },
    })
  })
})

describe('findSessionCookies', () => {
  it('finds the unchunked cookie', () => {
    expect(findSessionCookies(`${BASE}=abc`, BASE)).toEqual([BASE])
  })

  it('finds every chunk next-auth split the token into', () => {
    const raw = `${BASE}.0=a; ${BASE}.1=b; other=c`
    expect(findSessionCookies(raw, BASE)).toEqual([`${BASE}.0`, `${BASE}.1`])
  })

  it('ignores unrelated cookies', () => {
    expect(findSessionCookies('other=c; theme=dark', BASE)).toEqual([])
  })

  it('does not match a cookie that merely shares a prefix', () => {
    expect(findSessionCookies(`${BASE}-decoy=x`, BASE)).toEqual([])
  })

  it('handles a missing cookie header', () => {
    expect(findSessionCookies(undefined, BASE)).toEqual([])
  })
})

describe('stripCookie', () => {
  it('removes the session cookie and keeps the rest', () => {
    expect(stripCookie(`${BASE}=abc; theme=dark`, BASE)).toBe('theme=dark')
  })

  it('removes every chunk', () => {
    expect(stripCookie(`${BASE}.0=a; ${BASE}.1=b; theme=dark`, BASE)).toBe('theme=dark')
  })

  it('returns undefined when nothing survives', () => {
    expect(stripCookie(`${BASE}=abc`, BASE)).toBeUndefined()
  })

  it('returns undefined for a missing header', () => {
    expect(stripCookie(undefined, BASE)).toBeUndefined()
  })

  it('leaves a prefix-sharing cookie intact', () => {
    expect(stripCookie(`${BASE}-decoy=x`, BASE)).toBe(`${BASE}-decoy=x`)
  })
})

describe('revocation is enforced server-side', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

  it('runs as global middleware so no route can forget the check', () => {
    const code = source('server/middleware/sessionRevocation.ts')

    expect(code).toContain('isSessionActive')
    expect(code).toContain('dropSessionCookie')
  })

  it('fails closed — an unverifiable session is dropped, not trusted', () => {
    const code = source('server/middleware/sessionRevocation.ts')

    expect(code).toMatch(/let active = false/)
    expect(code).toMatch(/if \(!active\) dropSessionCookie\(event\)/)
  })

  it('derives the cookie name from one shared constant', () => {
    expect(source('server/api/auth/[...].ts')).toContain('name: sessionCookieName')
    expect(source('server/api/auth/[...].ts')).not.toContain('next-auth.session-token')
  })
})
