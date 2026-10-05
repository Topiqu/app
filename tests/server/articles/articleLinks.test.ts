import { describe, expect, it, vi } from 'vitest'

import { resolveArticleLinks } from '../../../server/utils/articleLinks'

type Row = Record<string, unknown>

/** Answers `findMany` from fixed rows, filtered the way the resolver queries them. */
const makeDb = ({
  articles = [],
  translations = [],
  redirects = [],
}: {
  articles?: Row[]
  translations?: Row[]
  redirects?: Row[]
}) => {
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, condition]) => {
      if (key === 'clientSiteId') return true
      if (condition && typeof condition === 'object' && 'in' in condition)
        return (condition.in as unknown[]).includes(row[key])
      if (condition && typeof condition === 'object' && 'not' in condition) return row[key] !== condition.not
      return row[key] === condition
    })
  const table = (rows: Row[]) => ({
    findMany: vi.fn(async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where))),
  })
  return { article: table(articles), articleTranslation: table(translations), articleSlugRedirect: table(redirects) }
}

const resolve = (db: ReturnType<typeof makeDb>, content: string, language: 'cs' | 'en' = 'cs') =>
  resolveArticleLinks(db, content, { clientSiteId: 'site', language, tenantDomain: 'blog.test' })

const compost = { id: 'a1', slug: 'kompost', language: 'cs', status: 'published' }

describe('resolveArticleLinks', () => {
  it('leaves content without article links alone and never queries', async () => {
    const db = makeDb({})
    const content = '<p>See <a href="https://example.org">source</a> and <a href="/cs">home</a>.</p>'

    expect(await resolve(db, content)).toBe(content)
    expect(db.article.findMany).not.toHaveBeenCalled()
  })

  it('follows a slug change through the redirect table, keeping the hash', async () => {
    const db = makeDb({ articles: [compost], redirects: [{ slug: 'old-kompost', articleId: 'a1' }] })

    expect(await resolve(db, '<p><a href="https://blog.test/cs/clanky/old-kompost#tips">kompost</a></p>')).toBe(
      '<p><a href="/cs/clanky/kompost#tips">kompost</a></p>',
    )
  })

  it('points at the published translation in the reader language, else the original', async () => {
    const translation = { articleId: 'a1', slug: 'compost', language: 'en', status: 'PUBLISHED' }
    const content = '<p><a href="/cs/clanky/kompost">compost</a></p>'

    expect(await resolve(makeDb({ articles: [compost], translations: [translation] }), content, 'en')).toBe(
      '<p><a href="/en/articles/compost">compost</a></p>',
    )
    expect(await resolve(makeDb({ articles: [compost] }), content, 'en')).toBe(content)
  })

  it('unwraps links to unpublished or missing articles', async () => {
    const db = makeDb({ articles: [{ ...compost, status: 'draft' }] })

    expect(
      await resolve(db, '<p>Read <a href="/cs/clanky/kompost">about <strong>compost</strong></a> or <a href="/cs/clanky/gone">this</a>.</p>'),
    ).toBe('<p>Read about <strong>compost</strong> or this.</p>')
  })
})
