// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultAiAuthorName } from '../../../shared/utils/aiAuthor'
import { ensureAiAuthor } from '../../../server/utils/ensureAiAuthor'

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => vi.stubGlobal('logAction', vi.fn().mockResolvedValue({})))

const setup = (language = 'en') => {
  const authors: any[] = []
  const db = {
    user: {
      findFirst: vi.fn(
        async ({ where }) =>
          authors.find(
            (author) => author.clientSiteId === where.clientSiteId && author.role === where.role && !author.deletedAt,
          ) ?? null,
      ),
      createMany: vi.fn(async ({ data }) => {
        authors.push(...data)
        return { count: data.length }
      }),
    },
    clientSite: {
      update: vi.fn(async () => ({ name: 'Trawl', language, logoUrl: 'https://cdn.test/logo.webp' })),
    },
  }
  vi.stubGlobal('serializableTransaction', (run: (tx: unknown) => unknown) => run(db))
  return { db, authors, ensure: () => ensureAiAuthor('site-1') }
}

describe('default editorial author', () => {
  it.each([
    ['cs', 'Redakce Trawl'],
    ['en', 'Trawl Editorial Team'],
    ['de', 'Redaktion Trawl'],
    ['fr', 'Rédaction Trawl'],
    ['es', 'Trawl Editorial Team'],
  ])('uses the publication language %s for the public byline', async (language, expected) => {
    const { ensure, authors } = setup(language)
    const author = await ensure()
    expect(author.username).toBe(expected)
    expect(author.avatarUrl).toBe('https://cdn.test/logo.webp')
    expect(authors).toEqual([
      expect.objectContaining({
        id: author.id,
        role: 'ai',
        clientSiteId: 'site-1',
        emailVerified: true,
        allowEmail: false,
        allowNotifs: false,
      }),
    ])
  })

  it('creates only one author and preserves a customized identity on later runs', async () => {
    const { ensure, db, authors } = setup()
    await ensure()
    authors[0].username = 'Our Technical Editor'
    authors[0].avatarUrl = 'https://cdn.test/custom.webp'
    const author = await ensure()
    expect(author.username).toBe('Our Technical Editor')
    expect(author.avatarUrl).toBe('https://cdn.test/custom.webp')
    expect(db.user.createMany).toHaveBeenCalledTimes(1)
  })

  it('does not use a human account when the publication has no AI author', async () => {
    const { ensure, authors } = setup()
    authors.push({ id: 'owner', role: 'admin', clientSiteId: 'site-1' })
    const author = await ensure()
    expect(author.id).not.toBe('owner')
    expect(author.username).toBe('Trawl Editorial Team')
  })

  it('replaces a deleted author with a new active editorial identity', async () => {
    const { ensure, authors } = setup()
    authors.push({ id: 'deleted-ai', role: 'ai', clientSiteId: 'site-1', deletedAt: new Date() })
    expect((await ensure()).id).not.toBe('deleted-ai')
  })

  it('reuses an author created while waiting for the tenant lock', async () => {
    const { ensure, db } = setup()
    const concurrent = { id: 'concurrent-ai', username: 'Our Editor', avatarUrl: null, bio: '' }
    db.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(concurrent)
    expect(await ensure()).toEqual(concurrent)
    expect(db.clientSite.update).toHaveBeenCalledTimes(1)
    expect(db.user.createMany).not.toHaveBeenCalled()
  })

  it('recovers from a global username collision without selecting another tenant’s author', async () => {
    const { ensure, db } = setup()
    db.user.createMany.mockResolvedValueOnce({ count: 0 })
    const author = await ensure()
    expect(author.username).toMatch(/^Trawl Editorial Team [0-9a-f]{8}$/)
    expect(author.username.length).toBeLessThanOrEqual(50)
    expect(db.user.createMany).toHaveBeenCalledTimes(2)
  })

  it('bounds a long international name without splitting a surrogate pair', () => {
    const name = defaultAiAuthorName('😀'.repeat(40), 'cs')
    expect(name.length).toBeLessThanOrEqual(50)
    expect(name).not.toMatch(/[\uD800-\uDBFF]$/)
  })
})
