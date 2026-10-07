// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dataForSeo = vi.fn()
vi.mock('../../../server/utils/keywords/dataforseo', () => ({ dataForSeo, hasDataForSeo: () => true }))
const fetchPage = vi.fn()
vi.mock('../../../server/utils/backlinks/page', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/utils/backlinks/page')>()),
  fetchPage,
}))
const mentionsBusiness = vi.fn()
vi.mock('../../../server/utils/backlinks/match', () => ({ mentionsBusiness, supplierPages: vi.fn() }))

const { findMentions } = await import('../../../server/utils/backlinks/mentions')

const site = { id: 's1', name: 'Kávovar Alfa', domain: 'alfa.topiqu.com', language: 'cs' as const, focus: 'káva' }
const owned = ['alfa.topiqu.com', 'kavovar-alfa.cz']

const citation = (url: string, snippet = 'Kávovar Alfa', spam = 5) => ({
  url,
  domain: new URL(url).hostname,
  spam_score: spam,
  content_info: { title: `Titulek ${url}`, snippet, language: 'cs', date_published: '2026-09-01' },
})

const ok = (text: string, links: unknown[] = [], contactUrl: string | null = null) => ({
  status: 'ok',
  title: 'Stránka',
  text,
  links,
  contactUrl,
})

beforeEach(() => {
  dataForSeo.mockImplementation(async (_path: string, task: { keyword: string }) => ({
    cost: 0.03,
    result: {
      items:
        task.keyword === 'kavovar-alfa.cz'
          ? [
              citation('https://blog.cz/recenze?utm_source=x'),
              citation('https://kavovar-alfa.cz/o-nas'),
              citation('https://cs.wikipedia.org/wiki/Kava'),
              citation('https://spam.cz/x', 'Kávovar Alfa', 80),
            ]
          : task.keyword === 'kávovar alfa'
            ? [citation('https://forum-kava.cz/vlakno'), citation('https://auta.cz/alfa-romeo', 'Alfa Romeo')]
            : [],
    },
  }))
  mentionsBusiness.mockResolvedValue([0])
})
afterEach(() => vi.clearAllMocks())

describe('findMentions', () => {
  it('searches the owned hosts and the name, lowercased', async () => {
    fetchPage.mockResolvedValue({ status: 'failed' })
    await findMentions(site, owned)
    expect(dataForSeo.mock.calls.map(([, task]) => task.keyword)).toEqual([
      'alfa.topiqu.com',
      'kavovar-alfa.cz',
      'kávovar alfa',
    ])
  })

  it('drops owned, reference and spammy pages, and asks the model only about name matches', async () => {
    fetchPage.mockResolvedValue({ status: 'failed' })
    const result = await findMentions(site, owned)
    expect(mentionsBusiness).toHaveBeenCalledWith(site, [
      expect.objectContaining({ url: 'https://forum-kava.cz/vlakno' }),
      expect.objectContaining({ url: 'https://auta.cz/alfa-romeo' }),
    ])
    expect(fetchPage.mock.calls.map(([url]) => url)).toEqual([
      'https://blog.cz/recenze',
      'https://forum-kava.cz/vlakno',
    ])
    expect(result.costUsd).toBeCloseTo(0.09)
  })

  it('turns a linking page into a backlink and a page still naming the business into an opportunity', async () => {
    fetchPage.mockImplementation(async (url: string) =>
      url === 'https://blog.cz/recenze'
        ? ok('Kupte na kavovar-alfa.cz', [{ href: 'https://kavovar-alfa.cz/', rel: [], anchor: 'Alfa' }])
        : ok('Na fóru doporučují Kávovar Alfa.', [], 'https://forum-kava.cz/kontakt'),
    )
    const result = await findMentions(site, owned)
    expect(result.found).toEqual([
      {
        sourceUrl: 'https://blog.cz/recenze',
        sourceDomain: 'blog.cz',
        link: { href: 'https://kavovar-alfa.cz/', rel: [], anchor: 'Alfa' },
      },
    ])
    expect(result.opportunities).toEqual([
      expect.objectContaining({
        sourceUrl: 'https://forum-kava.cz/vlakno',
        contactUrl: 'https://forum-kava.cz/kontakt',
        evidence: expect.objectContaining({ term: 'Kávovar Alfa', language: 'cs' }),
      }),
    ])
  })

  it('skips a page that no longer names the business', async () => {
    fetchPage.mockResolvedValue(ok('Tady už nic není.'))
    expect((await findMentions(site, owned)).opportunities).toEqual([])
  })

  it('does not search a name the domain already spells', async () => {
    fetchPage.mockResolvedValue({ status: 'failed' })
    await findMentions({ ...site, name: 'Kavovar-Alfa' }, owned)
    expect(dataForSeo).toHaveBeenCalledTimes(2)
    expect(mentionsBusiness).not.toHaveBeenCalled()
  })

  it('fails only when every search fails', async () => {
    dataForSeo.mockRejectedValue(new Error('DataForSEO down'))
    await expect(findMentions(site, owned)).rejects.toThrow('DataForSEO down')
  })
})
