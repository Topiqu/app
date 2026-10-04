import { $fetch } from 'ofetch'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ideasFromLabs } from '../../../server/utils/keywords/plan'
import { dataForSeo } from '../../../server/utils/keywords/dataforseo'

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
})
