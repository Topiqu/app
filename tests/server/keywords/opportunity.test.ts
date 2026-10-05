import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assessOpportunities } from '../../../server/utils/keywords/opportunity'

vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }))

const site = { id: 's1', language: 'cs' as const, focus: 'Příprava kávy doma', audience: 'začátečníci' }
const candidate = (keyword: string) => ({
  keyword,
  volume: 90,
  difficulty: 12,
  intent: 'informational',
  questions: [],
  aiOverview: false,
  organic: [],
})
const decision = (item: number, changes = {}) => ({
  item,
  write: true,
  coveredBy: 0,
  duplicateOf: 0,
  articleFit: 'strong',
  specificity: 'focused',
  intent: 'informational',
  angle: 'Jak opravit kyselé espresso?',
  reason: 'Konkrétní problém domácích baristů, který blog ještě neřeší.',
  ...changes,
})

describe('keyword opportunities', () => {
  beforeEach(() => {
    vi.stubGlobal('aiModel', (task: string) => task)
    vi.stubGlobal('recordAiUsage', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('uses observed result pages and existing summaries to assess the actual reader need', async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: { decisions: [decision(1)] },
      usage: { totalTokens: 300 },
    } as never)
    const organic = [
      {
        title: 'Jak opravit kyselé espresso',
        url: 'https://example.com/espresso',
        domain: 'example.com',
        description: 'Teplota a hrubost mletí',
      },
    ]
    const result = await assessOpportunities(
      site,
      [{ ...candidate('kyselé espresso'), organic }],
      [{ title: 'Domácí káva', excerpt: 'Přehled metod přípravy.' }],
    )
    expect(result.accepted.map((entry) => entry.index)).toEqual([0])
    const call = vi.mocked(generateText).mock.calls[0]![0]
    expect(call.prompt).toContain('Teplota a hrubost mletí')
    expect(call.prompt).toContain('Přehled metod přípravy.')
    expect(recordAiUsage).toHaveBeenCalledWith('s1', 300, 'KEYWORD_PLAN_OPPORTUNITY_TOKENS', expect.anything())
  })

  it('rejects covered, duplicate, navigational and unsuitable queries even if write is true', async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        decisions: [
          decision(1),
          decision(2, { coveredBy: 1 }),
          decision(3, { duplicateOf: 1 }),
          decision(4, { intent: 'navigational' }),
          decision(5, { articleFit: 'poor' }),
        ],
      },
      usage: {},
    } as never)
    const result = await assessOpportunities(
      site,
      ['nové', 'pokryté', 'synonymum', 'login', 'checkout'].map(candidate),
      [{ title: 'Pokryté' }],
    )
    expect(result.accepted.map((entry) => entry.index)).toEqual([0])
  })

  it('turns a covered need the covering article misses into an expansion of that article', async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        decisions: [
          decision(1, { write: false, coveredBy: 2, extendsArticle: true, angle: 'Jaký mlýnek na espresso?' }),
          decision(2, { write: false, coveredBy: 1, extendsArticle: false }),
          decision(3, { write: false, coveredBy: 9, extendsArticle: true }),
        ],
      },
      usage: {},
    } as never)
    const result = await assessOpportunities(
      site,
      ['mlýnek na espresso', 'domácí káva', 'vymyšlený článek'].map(candidate),
      [{ title: 'Domácí káva' }, { title: 'Espresso doma' }],
    )
    expect(result.accepted).toEqual([])
    expect(result.expansions).toEqual([
      { index: 0, article: 1, angle: 'Jaký mlýnek na espresso?', reason: expect.any(String) },
    ])
  })

  it('fails closed on an incomplete assessment instead of replacing the usable plan', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { decisions: [decision(1)] }, usage: {} } as never)
    await expect(assessOpportunities(site, [candidate('a'), candidate('b')], [])).rejects.toThrow('Incomplete')
  })

  it('rejects repeated or invented candidate indexes', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: { decisions: [decision(2)] }, usage: {} } as never)
    await expect(assessOpportunities(site, [candidate('a')], [])).rejects.toThrow('Invalid')
  })

  it('does not call the model for an empty candidate list', async () => {
    await expect(assessOpportunities(site, [], [])).resolves.toEqual({ accepted: [], expansions: [] })
    expect(generateText).not.toHaveBeenCalled()
  })
})
