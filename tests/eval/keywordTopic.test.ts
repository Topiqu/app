// @vitest-environment node
import { createOpenAI } from '@ai-sdk/openai'
import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(
    import('../../server/utils/ai/formats'),
    'allowedModulesFor',
    'ARTICLE_FORMAT_NAMES',
    'ARTICLE_MODULE_NAMES',
    'ARTICLE_STRUCTURE_VARIANTS',
    'formatMenu',
    'isStructureVariantFor',
  )
}

await stubImports()

const { pickArticleTopic } = await import('../../server/utils/ai/topic')
const { AI_MODELS } = await import('../../server/utils/ai/modelRegistry')

const cases = [
  {
    focus: 'Domácí příprava espressa: praktické návody pro začátečníky',
    keyword: 'kyselé espresso jak opravit',
    need: 'Jak krok za krokem upravit mletí a extrakci, když espresso chutná kysele.',
    recent: 'Jak připravit první espresso: základní postup a vybavení.',
  },
  {
    focus: 'Dostupná auta pro rodiny: výběr levných ojetin',
    keyword: 'ojetá fabia nebo sandero',
    need: 'Které z těchto dvou aut vybrat podle prostoru, spolehlivosti a provozních nákladů.',
    recent: 'Co kontrolovat při koupi jakéhokoliv ojetého auta.',
  },
  {
    focus: 'RPG hry: praktické návody pro hráče',
    keyword: 'baldurs gate 3 multiclass paladin warlock',
    need: 'Jak sestavit Paladin/Warlock multiclass a jaké úrovně zvolit.',
    recent: 'Jak začít v Baldur’s Gate 3: základní povolání, ovládání a dialogy, bez multiclassu.',
  },
]

describe.skipIf(process.env.AI_EVAL !== '1')('keyword plan reaches the topic picker', () => {
  beforeAll(() => {
    process.loadEnvFile?.('.env')
    const openAi = createOpenAI({ apiKey: process.env.NUXT_OPEN_AI_API_KEY })
    vi.stubGlobal('aiModel', (task: keyof typeof AI_MODELS) => openAi(AI_MODELS[task].id))
  })
  afterAll(() => vi.unstubAllGlobals())

  it.concurrent.each(cases)(
    '$keyword',
    async (testCase) => {
      const { topic } = await pickArticleTopic({
        focus: testCase.focus,
        language: 'cs',
        recentExcerpts: [testCase.recent],
        plan: [
          `keyword "${testCase.keyword}"; about 100 searches a month; informational intent; unanswered need: ${testCase.need}; evidence: serp`,
        ],
      })
      expect(topic.planKeyword).toBe(testCase.keyword)
      expect(topic.topic.length).toBeGreaterThan(10)
      expect(topic.angle.length).toBeGreaterThan(10)
      expect(topic.newsItem).toBe(0)
    },
    120_000,
  )
})

beforeEach(stubImports)
