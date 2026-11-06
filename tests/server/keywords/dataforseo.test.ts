import { $fetch } from 'ofetch'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/planFeatures'), 'activeFeatureFilter')
  await stubNitroImports(import('../../../server/utils/keywords/dataforseo'), 'dataForSeo', 'hasDataForSeo')
  await stubNitroImports(
    import('../../../server/utils/keywords/rank'),
    'rankHistoryFor',
    'blogPosition',
    'isArticleUrl',
  )
  await stubNitroImports(import('../../../server/utils/keywords/serp'), 'serpSignals')
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(import('../../../server/utils/ai/researchEvidence'), 'researchTopic')
  await stubNitroImports(import('../../../server/utils/keywords/refresh'), 'suggestExpansions')
  await stubNitroImports(import('../../../server/utils/keywords/scope'), 'inScope', 'siteKeywords', 'siteProfile')
  await stubNitroImports(import('../../../server/utils/keywords/opportunity'), 'assessOpportunities')
}

await stubImports()

const { ideasFromLabs } = await import('../../../server/utils/keywords/plan')
const { dataForSeo } = await import('../../../server/utils/keywords/dataforseo')

vi.mock('ofetch', () => ({ $fetch: vi.fn() }))
afterEach(() => vi.clearAllMocks())

describe('DataForSEO response contract', () => {
  it('preserves the separate seed and suggestion results documented for include_seed_keyword', async () => {
    vi.mocked($fetch).mockResolvedValue({
      status_code: 20000,
      cost: 0.01,
      tasks: [
        {
          status_code: 20000,
          result: [
            {
              seed_keyword: 'espresso',
              seed_keyword_data: { keyword: 'espresso', keyword_info: { search_volume: 1000 } },
            },
            { location_code: 2203, items: [{ keyword: 'espresso doma', keyword_info: { search_volume: 90 } }] },
          ],
        },
      ],
    })
    const response = await dataForSeo<{ seed_keyword_data?: { keyword: string }; items?: { keyword: string }[] }>(
      '/dataforseo_labs/google/keyword_suggestions/live',
      { keyword: 'espresso', include_seed_keyword: true },
    )
    expect(ideasFromLabs(response.results, 'espresso').map((idea) => idea.keyword)).toEqual([
      'espresso',
      'espresso doma',
    ])
    expect(response.cost).toBe(0.01)
  })

  it('also accepts a single result containing both seed data and suggestions', () => {
    expect(
      ideasFromLabs([{ seed_keyword_data: { keyword: 'káva' }, items: [{ keyword: 'káva doma' }] }], 'káva'),
    ).toHaveLength(2)
  })

  it('rejects task errors even when the outer response succeeded', async () => {
    vi.mocked($fetch).mockResolvedValue({
      status_code: 20000,
      tasks: [{ status_code: 40102, status_message: 'No credit' }],
    })
    await expect(dataForSeo('/test', {})).rejects.toThrow('No credit')
  })

  it('reserves each live call against the SEO guard at its endpoint ceiling', async () => {
    const reserve = vi.fn(async () => ({ id: 'reservation' }))
    const settle = vi.fn(async () => undefined)
    vi.stubEnv('DATAFORSEO_SANDBOX', '0')
    vi.stubGlobal('reserveAiAllowance', reserve)
    vi.stubGlobal('settleAiAllowance', settle)
    vi.mocked($fetch).mockResolvedValue({
      status_code: 20000,
      cost: 0.002,
      tasks: [{ status_code: 20000, result: [] }],
    })
    try {
      await dataForSeo('/serp/google/organic/live/advanced', {}, 'blog-a')
      await dataForSeo('/dataforseo_labs/google/keyword_suggestions/live', {}, 'blog-a')
      await dataForSeo('/content_analysis/search/live', {}, 'blog-a')
      expect(reserve.mock.calls.map((call: unknown[]) => [call[1], call[2]])).toEqual([
        ['SEO', 20_000],
        ['SEO', 50_000],
        ['SEO', 200_000],
      ])
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    }
  })
})

beforeEach(stubImports)
