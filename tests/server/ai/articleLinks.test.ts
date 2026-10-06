import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { insertArticleLinks, linkArticle, loadLinkCandidates } from '../../../server/utils/ai/articleLinks'

const { generateStructuredText } = vi.hoisted(() => ({
  generateStructuredText: vi.fn<(typeof import('ai'))['generateText']>(),
}))

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: generateStructuredText,
}))

const compost = { id: 'a1', slug: 'kompostovani', title: 'Jak začít kompostovat', excerpt: 'Základy kompostu.' }
const soil = { id: 'a2', slug: 'puda', title: 'Zdravá půda', excerpt: null }
const candidates = [compost, soil]

const body =
  '<h2>Zahrada</h2><p>Kompost na zahradě zlepší půdu.</p><p>Zdravá půda drží vodu.</p>' +
  '<figure><figcaption>Kompost v zahradě</figcaption></figure><blockquote><p>Kompost je zlato.</p></blockquote>'

const link = (paragraph: number, anchor: string, articleId: string) => ({ paragraph, anchor, articleId })

describe('insertArticleLinks', () => {
  it('wraps the verbatim anchor with a path to the offered article', () => {
    const html = insertArticleLinks(body, [link(0, 'Kompost na zahradě', 'a1')], candidates, 'cs')
    expect(html).toContain('<p><a href="/cs/clanky/kompostovani">Kompost na zahradě</a> zlepší půdu.</p>')
  })

  it('drops links the model invented or could not anchor', () => {
    const links = [
      link(0, 'Kompost', 'not-offered'),
      link(0, 'Kompost na balkoně', 'a1'),
      link(9, 'Kompost', 'a1'),
      link(1, 'Zdravá', 'a2'),
    ]
    expect(insertArticleLinks(body, links.slice(0, 3), candidates, 'cs')).toBe(body)
    expect(insertArticleLinks(body, links, candidates, 'cs')).toContain('<a href="/cs/clanky/puda">Zdravá</a>')
  })

  it('never links inside a word, a caption or a quotation', () => {
    expect(insertArticleLinks('<p>pestrý pes.</p>', [link(0, 'pes', 'a1')], candidates, 'cs')).toBe(
      '<p>pestrý <a href="/cs/clanky/kompostovani">pes</a>.</p>',
    )
    // Only the two body paragraphs are offered; index 2 would be the quoted one.
    expect(insertArticleLinks(body, [link(2, 'Kompost', 'a1')], candidates, 'cs')).toBe(body)
  })

  it('links each article once, one per paragraph, never twice to an existing target', () => {
    const html = insertArticleLinks(
      body,
      [link(0, 'Kompost', 'a1'), link(0, 'půdu', 'a2'), link(1, 'půda', 'a1')],
      candidates,
      'cs',
    )
    expect(html.match(/<a /g)).toHaveLength(1)

    const linked = '<p>Viz <a href="/cs/clanky/kompostovani">návod</a>. Kompost pomáhá.</p>'
    expect(insertArticleLinks(linked, [link(0, 'Kompost', 'a1')], candidates, 'cs')).toBe(linked)
  })

  it('escapes the surrounding text it rewrites', () => {
    const html = insertArticleLinks('<p>Kompost &amp; &lt;půda&gt;</p>', [link(0, 'Kompost', 'a1')], candidates, 'cs')
    expect(html).toBe('<p><a href="/cs/clanky/kompostovani">Kompost</a> &amp; &lt;půda&gt;</p>')
  })
})

describe('linkArticle', () => {
  const findMany = vi.fn()

  beforeEach(() => {
    vi.mocked(generateStructuredText).mockReset()
    findMany.mockReset()
    vi.stubGlobal('prisma', { article: { findMany } })
    vi.stubGlobal('aiModel', () => 'test-model')
    vi.stubGlobal('reportCaughtError', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ranks shared tags first, then recency, and excludes the article itself', async () => {
    findMany.mockResolvedValue([
      { ...soil, tags: [] },
      { ...compost, tags: [{ tagId: 't1' }] },
    ])
    const ranked = await loadLinkCandidates('site', 'cs', { tagIds: ['t1'], excludeId: 'self' })

    expect(ranked.map(({ id }) => id)).toEqual(['a1', 'a2'])
    expect(findMany.mock.calls[0]![0].where).toEqual({
      clientSiteId: 'site',
      language: 'cs',
      status: 'published',
      id: { not: 'self' },
    })
  })

  it('skips the model when the site has nothing to link', async () => {
    findMany.mockResolvedValue([])
    const result = await linkArticle('site', { title: 'Zahrada', content: body }, 'cs')

    expect(result).toEqual({ content: body, tokens: 0 })
    expect(generateStructuredText).not.toHaveBeenCalled()
  })

  it('applies the chosen links and reports their tokens', async () => {
    findMany.mockResolvedValue([{ ...compost, tags: [] }])
    vi.mocked(generateStructuredText).mockResolvedValue({
      output: { links: [link(0, 'Kompost na zahradě', 'a1')] },
      usage: { totalTokens: 42 },
    } as never)

    const result = await linkArticle('site', { title: 'Zahrada', content: body }, 'cs')

    expect(result.tokens).toBe(42)
    expect(result.content).toContain('href="/cs/clanky/kompostovani"')
  })

  it('returns the article unchanged when linking fails', async () => {
    findMany.mockResolvedValue([{ ...compost, tags: [] }])
    vi.mocked(generateStructuredText).mockRejectedValue(new Error('provider down'))

    expect(await linkArticle('site', { title: 'Zahrada', content: body }, 'cs')).toEqual({ content: body, tokens: 0 })
  })
})
