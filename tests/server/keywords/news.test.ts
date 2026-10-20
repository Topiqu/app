import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dataForSeo = vi.fn()
vi.mock('../../../server/utils/keywords/dataforseo', () => ({ dataForSeo, hasDataForSeo: () => true }))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

const { fetchNews, newsItems, newsQuery, newsSignal } = await import('../../../server/utils/keywords/news')

const NOW = new Date('2026-10-04T12:00:00Z')
const story = (title: string, timestamp: string, url = 'https://auto.cz/a', snippet = '') => ({
  type: 'news_search',
  title,
  snippet,
  url,
  domain: 'auto.cz',
  timestamp,
})

describe('newsQuery', () => {
  it('ORs the terms and quotes phrases', () => {
    expect(newsQuery(['RPG', 'Kingdom Come', 'rpg'])).toBe('RPG OR "Kingdom Come"')
  })

  it('strips apostrophes and quotes, which empty a Google News result', () => {
    expect(newsQuery(["Baldur's Gate", '"OR" hry'])).toBe('"Baldurs Gate" OR hry')
  })

  it('caps the number of terms and returns nothing for no terms', () => {
    expect(newsQuery(['a', 'b', 'c', 'd', 'e', 'f']).split(' OR ')).toHaveLength(5)
    expect(newsQuery([' '])).toBe('')
  })
})

describe('newsItems', () => {
  it('keeps recent stories once, with their snippet', () => {
    expect(
      newsItems(
        [
          story(
            'BMW spustilo výrobu  baterií',
            '2026-10-03 13:44:53 +00:00',
            'https://auto.cz/baterie',
            'Nový  závod.',
          ),
          story('bmw spustilo výrobu baterií', '2026-10-04 05:44:54 +00:00', 'https://other.cz/x'),
          { type: 'top_stories', title: 'Novinky: BMW' },
          story('Stará zpráva', '2026-09-20 10:00:00 +00:00', 'https://auto.cz/old'),
          story('Bez data', '', 'https://auto.cz/none'),
        ],
        NOW,
      ),
    ).toEqual([
      {
        title: 'BMW spustilo výrobu baterií',
        snippet: 'Nový závod.',
        url: 'https://auto.cz/baterie',
        domain: 'auto.cz',
        publishedAt: '2026-10-03T13:44:53.000Z',
      },
    ])
  })
})

describe('fetchNews', () => {
  const site = { id: 's1', language: 'cs' as const, focus: 'RPG hry', keywords: ['RPG'] }

  beforeEach(() => {
    vi.stubGlobal('aiModel', (task: string) => task)
    vi.stubGlobal('recordAiUsage', vi.fn())
    dataForSeo.mockImplementation(async (_path: string, task: { keyword: string }) => ({
      cost: 0.002,
      result: {
        items:
          task.keyword === 'RPG'
            ? [
                story(
                  'Hra Exodus má datum vydání',
                  '2026-10-04 08:00:00 +00:00',
                  'https://hry.cz/1',
                  'Sci-fi RPG od bývalých tvůrců Mass Effectu…',
                ),
                story(
                  'GTA VI ukázalo nový trailer',
                  '2026-10-04 09:00:00 +00:00',
                  'https://hry.cz/2',
                  'Rockstar ukázal akční…',
                ),
              ]
            : [story('Zaklínač 3 Remastered dostal patch', '2026-10-03 10:00:00 +00:00', 'https://hry.cz/3')],
      },
    }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('asks the category and the plan separately and keeps what the scope check keeps', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { keep: [1, 3] }, usage: {} } as never)
    const news = await fetchNews(site, [['RPG'], ['zaklínač 3', 'kingdom come']], NOW)

    expect(dataForSeo.mock.calls.map(([, task]) => task.keyword)).toEqual(['RPG', '"zaklínač 3" OR "kingdom come"'])
    expect(dataForSeo.mock.calls[0]![1]).toMatchObject({ location_code: 2203, language_code: 'cs' })
    expect(news.items.map((item) => item.url)).toEqual(['https://hry.cz/1', 'https://hry.cz/3'])
    expect(news).toMatchObject({ found: 3, failedQueries: 0, costUsd: 0.004 })
  })

  it('shows the scope check the snippet, so an unknown title is judged by what it is', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { keep: [] }, usage: {} } as never)
    await fetchNews(site, [['RPG']], NOW)
    const prompt = String((vi.mocked(generateText).mock.calls[0]![0] as { prompt: string }).prompt)
    expect(prompt).toContain('1. Hra Exodus má datum vydání (auto.cz) — Sci-fi RPG od bývalých tvůrců Mass Effectu…')
  })

  it('fails closed when the scope check fails', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('model down'))
    await expect(fetchNews(site, [['RPG']], NOW)).rejects.toThrow('model down')
  })

  it('skips the scope call when no query answered', async () => {
    dataForSeo.mockRejectedValue(new Error('timeout'))
    const news = await fetchNews(site, [['RPG'], ['zaklínač']], NOW)
    expect(news).toMatchObject({ items: [], found: 0, failedQueries: 2 })
    expect(generateText).not.toHaveBeenCalled()
  })

  it('does not query twice when the plan repeats the keywords', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { keep: [] }, usage: {} } as never)
    await fetchNews(site, [['RPG'], ['rpg'], []], NOW)
    expect(dataForSeo).toHaveBeenCalledTimes(1)
  })
})

describe('newsSignal', () => {
  it('numbers the headline with its source, day and snippet', () => {
    expect(
      newsSignal(
        {
          title: 'Titulek',
          snippet: 'Perex.',
          url: 'https://idnes.cz/a',
          domain: 'idnes.cz',
          publishedAt: '2026-10-03T08:15:00.000Z',
        },
        1,
      ),
    ).toBe('[2] "Titulek" (idnes.cz, 2026-10-03): Perex.')
  })
})
