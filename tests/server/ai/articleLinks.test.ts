import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/aiUsage'), 'recordAiUsage')
  await stubNitroImports(import('../../../server/utils/ai/articleUsage'), 'withArticleUsageStage')
  await stubNitroImports(import('../../../server/utils/databaseJson'), 'toDatabaseJson')
  await stubNitroImports(import('../../../server/utils/sanitize'), 'escapeHtml')
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
}

vi.mock('../../../server/utils/knowledge/productImage', () => ({ copyProductImages: vi.fn(async () => {}) }))

await stubImports()

const { createArticleGenerationAudit } = await import('../../../server/utils/articleGenerationAudit')
const { insertArticleLinks, linkArticle, loadLinkCandidates } = await import('../../../server/utils/ai/articleLinks')

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

const link = (paragraph: number, anchor: string, target: string) => ({ paragraph, anchor, target })
const insertLinks = (...args: Parameters<typeof insertArticleLinks>) => insertArticleLinks(...args).html

describe('insertArticleLinks', () => {
  it('wraps the verbatim anchor with a path to the offered article', () => {
    const html = insertLinks(body, [link(0, 'Kompost na zahradě', 'a1')], candidates, 'cs')
    expect(html).toContain('<p><a href="/cs/clanky/kompostovani">Kompost na zahradě</a> zlepší půdu.</p>')
  })

  it('drops links the model invented or could not anchor', () => {
    const links = [
      link(0, 'Kompost', 'not-offered'),
      link(0, 'Kompost na balkoně', 'a1'),
      link(9, 'Kompost', 'a1'),
      link(1, 'Zdravá', 'a2'),
    ]
    expect(insertLinks(body, links.slice(0, 3), candidates, 'cs')).toBe(body)
    expect(insertLinks(body, links, candidates, 'cs')).toContain('<a href="/cs/clanky/puda">Zdravá</a>')
  })

  it('never links inside a word, a caption or a quotation', () => {
    expect(insertLinks('<p>pestrý pes.</p>', [link(0, 'pes', 'a1')], candidates, 'cs')).toBe(
      '<p>pestrý <a href="/cs/clanky/kompostovani">pes</a>.</p>',
    )
    // Only the two body paragraphs are offered; index 2 would be the quoted one.
    expect(insertLinks(body, [link(2, 'Kompost', 'a1')], candidates, 'cs')).toBe(body)
  })

  it('links each article once, one per paragraph, never twice to an existing target', () => {
    const html = insertLinks(
      body,
      [link(0, 'Kompost', 'a1'), link(0, 'půdu', 'a2'), link(1, 'půda', 'a1')],
      candidates,
      'cs',
    )
    expect(html.match(/<a /g)).toHaveLength(1)

    const linked = '<p>Viz <a href="/cs/clanky/kompostovani">návod</a>. Kompost pomáhá.</p>'
    expect(insertLinks(linked, [link(0, 'Kompost', 'a1')], candidates, 'cs')).toBe(linked)
  })

  it('escapes the surrounding text it rewrites', () => {
    const html = insertLinks('<p>Kompost &amp; &lt;půda&gt;</p>', [link(0, 'Kompost', 'a1')], candidates, 'cs')
    expect(html).toBe('<p><a href="/cs/clanky/kompostovani">Kompost</a> &amp; &lt;půda&gt;</p>')
  })

  const sites = [
    { url: 'https://shop.test/kompostery', title: 'Kompostéry', productId: null },
    { url: 'https://shop.test/hnojivo?a=1&b=2', title: 'Hnojivo', productId: 'p1' },
    { url: 'https://shop.test/ryc', title: 'Rýč', productId: 'p2' },
  ]
  const garden =
    '<p>Kompost zlepší půdu.</p><p>Hnojivo doplní dusík.</p><p>Rýč usnadní práci.</p><p>Půda drží vodu.</p>'

  it("links the publisher's offered pages by W number, capped and alongside article links", () => {
    const result = insertArticleLinks(
      garden,
      [link(0, 'Kompost', 'W1'), link(1, 'Hnojivo', 'W2'), link(2, 'Rýč', 'W3'), link(3, 'Půda', 'a2')],
      candidates,
      'cs',
      sites,
    )
    expect(result).toMatchObject({ siteLinks: 2, articleLinks: 1, productIds: ['p1'] })
    expect(result.html).toContain('<a href="https://shop.test/kompostery">Kompost</a>')
    expect(result.html).toContain('<p><a href="https://shop.test/hnojivo?a=1&amp;b=2">Hnojivo</a> doplní dusík.</p>')
    expect(result.html).not.toContain('https://shop.test/ryc')
    expect(result.html).toContain('<a href="/cs/clanky/puda">Půda</a>')
  })

  it('puts a card for a linked product after its top-level block, once per product', () => {
    const list = '<ul><li>Hnojivo doplní dusík.</li><li>Rýč usnadní práci.</li></ul><p>Konec.</p>'
    const result = insertArticleLinks(list, [link(0, 'Hnojivo', 'W2'), link(1, 'Rýč', 'W3')], candidates, 'cs', sites)
    expect(result.productIds).toEqual(['p1', 'p2'])
    expect(result.html).toMatch(
      /<\/ul><div data-type="product" data-product-id="p1"[^>]*>.*?<\/div><div data-type="product" data-product-id="p2"/,
    )
    expect(result.html).toContain(
      '<div data-type="product" data-product-id="p1" data-url="https://shop.test/hnojivo?a=1&amp;b=2" data-name="Hnojivo"><p><a href="https://shop.test/hnojivo?a=1&amp;b=2">Hnojivo</a></p></div>',
    )
    // The card's own link counts as linked, so relinking a carded body adds neither.
    expect(insertArticleLinks(result.html, [link(0, 'Hnojivo', 'W2')], [], 'cs', sites).productIds).toEqual([])
  })

  it('links the subject before the website pages that would use up the cap', () => {
    const result = insertArticleLinks(
      garden,
      [link(0, 'Kompost', 'W1'), link(2, 'Rýč', 'W3'), link(1, 'Hnojivo', 'W2')],
      [],
      'cs',
      sites,
      'W2',
    )
    expect(result).toMatchObject({ siteLinks: 2, productIds: ['p1'] })
    expect(result.html).toContain('<a href="https://shop.test/hnojivo?a=1&amp;b=2">Hnojivo</a>')
    expect(result.html).toContain('<a href="https://shop.test/kompostery">Kompost</a>')
    expect(result.html).not.toContain('https://shop.test/ryc')
  })

  it('keeps the card of a subject product whose anchor did not hold', () => {
    const missed = insertArticleLinks(garden, [link(1, 'Hnojiva', 'W2')], [], 'cs', sites, 'W2')
    expect(missed).toMatchObject({ siteLinks: 0, productIds: ['p1'] })
    expect(missed.html).toMatch(/<p>Hnojivo doplní dusík\.<\/p><div data-type="product" data-product-id="p1"/)

    const unproposed = insertArticleLinks(garden, [], [], 'cs', sites, 'W2')
    expect(unproposed.html).toMatch(
      /<p>Půda drží vodu\.<\/p><div data-type="product" data-product-id="p1"[^>]*>.*<\/div>$/,
    )
    expect(insertArticleLinks(garden, [], [], 'cs', sites, 'W1').html).toBe(garden)
  })

  it('never links a page that was not offered or is already linked', () => {
    const linked = '<p>Viz <a href="https://shop.test/kompostery">kompostéry</a>.</p><p>Kompost zlepší půdu.</p>'
    expect(insertLinks(linked, [link(1, 'Kompost', 'W1')], candidates, 'cs', sites)).toBe(linked)
    expect(insertLinks(garden, [link(0, 'Kompost', 'W9')], candidates, 'cs', sites)).toBe(garden)
    expect(insertLinks(garden, [link(0, 'Kompost', 'W1')], candidates, 'cs')).toBe(garden)
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

  it("offers the publisher's pages even when the site has no articles yet", async () => {
    findMany.mockResolvedValue([])
    vi.mocked(generateStructuredText).mockResolvedValue({
      output: { links: [link(0, 'Kompost na zahradě', 'W1')] },
      usage: { totalTokens: 9 },
    } as never)
    const siteTargets = [{ url: 'https://shop.test/kompostery', title: 'Kompostéry', productId: null }]

    const result = await linkArticle('site', { title: 'Zahrada', content: body }, 'cs', { siteTargets })

    expect(result.content).toContain('<a href="https://shop.test/kompostery">Kompost na zahradě</a>')
    expect(vi.mocked(generateStructuredText).mock.calls[0]![0].prompt).toContain(
      '- W1: Kompostéry · https://shop.test/kompostery',
    )
  })

  it('returns the article unchanged when linking fails', async () => {
    findMany.mockResolvedValue([{ ...compost, tags: [] }])
    vi.mocked(generateStructuredText).mockRejectedValue(new Error('provider down'))

    const log = vi.fn()
    vi.stubGlobal('logAction', log)
    const audit = createArticleGenerationAudit({ attemptId: 'attempt-1', mode: 'manual', clientSiteId: 'site' })
    expect(await linkArticle('site', { title: 'Zahrada', content: body }, 'cs', { audit })).toEqual({
      content: body,
      tokens: 0,
    })
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ARTICLE_GENERATION_STEP_FAILED',
        metadata: expect.objectContaining({ stage: 'linking', error: 'provider down' }),
      }),
    )
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ARTICLE_GENERATION_FALLBACK',
        metadata: expect.objectContaining({ stage: 'linking', outcome: 'unchanged_content' }),
      }),
    )
  })
})

beforeEach(stubImports)
