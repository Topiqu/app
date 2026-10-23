// @vitest-environment node
import { join } from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import { mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest'

import type { OpportunityCandidate } from '../../server/utils/keywords/opportunity'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(import('../../server/utils/keywords/scope'), 'siteProfile')
}

await stubImports()

const { AI_MODELS } = await import('../../server/utils/ai/modelRegistry')
const { assessOpportunities } = await import('../../server/utils/keywords/opportunity')

// Controlled SERP fixtures test editorial decisions, not predictions of future traffic.
const page = (title: string, path: string, description = '') => ({
  title,
  url: `https://example.com/${path}`,
  domain: 'example.com',
  description,
})
const query = (keyword: string, pages: ReturnType<typeof page>[] = [], volume = 100): OpportunityCandidate => ({
  keyword,
  volume,
  difficulty: 15,
  intent: 'informational',
  questions: [],
  aiOverview: false,
  organic: pages,
})
const cases = [
  {
    id: 'coffee-intent-and-coverage',
    language: 'cs' as const,
    focus: 'Domácí příprava kávy: návody pro začínající baristy',
    audience: 'lidé připravující espresso doma',
    articles: [
      {
        title: 'Hořký šálek? Upravte extrakci',
        excerpt: 'Proč espresso hořkne a jak změnit teplotu, mletí a čas extrakce.',
      },
    ],
    candidates: [
      query('kyselé espresso jak opravit', [
        page('Jak napravit kyselé espresso', 'kysela-kava', 'Mletí, teplota a poměr kávy a vody.'),
      ]),
      query('proč je espresso hořké', [page('Proč chutná káva hořce?', 'horka-kava')]),
      query('delonghi přihlášení', [page('Přihlášení k účtu DeLonghi', 'login')], 9000),
      query(
        'zrnková káva koupit',
        [page('Zrnková káva – nabídka e-shopu', 'shop'), page('Zrnková káva skladem', 'buy')],
        8000,
      ),
      query('jak vyčistit parní trysku', [], 0),
      query(
        'espresso macchiato',
        [
          page('Espresso Macchiato – official music video', 'music'),
          page('Espresso Macchiato lyrics', 'lyrics'),
          page('Eurovision song Espresso Macchiato', 'eurovision'),
        ],
        4400,
      ),
    ],
    keep: ['kyselé espresso jak opravit', 'jak vyčistit parní trysku'],
    drop: ['proč je espresso hořké', 'delonghi přihlášení', 'zrnková káva koupit', 'espresso macchiato'],
  },
  {
    id: 'affordable-cars-demand-is-not-fit',
    language: 'cs' as const,
    focus: 'Dostupná auta pro běžné rodiny: levné nové a ojeté vozy',
    audience: 'rodiny s omezeným rozpočtem',
    articles: [],
    candidates: [
      query('ojetá fabia nebo sandero', [page('Fabia vs. Sandero: kterou ojetinu vybrat', 'comparison')], 150),
      query('koenigsegg cena', [page('Koenigsegg za desítky milionů', 'hypercars')], 15000),
      query('škoda auto oficiální web', [page('Škoda Auto – oficiální stránky', 'official')], 12000),
      query(
        'fabia bazar praha',
        [page('Škoda Fabia Praha – inzerce', 'listing'), page('Fabia skladem v Praze', 'dealer')],
        9000,
      ),
    ],
    keep: ['ojetá fabia nebo sandero'],
    drop: ['koenigsegg cena', 'škoda auto oficiální web', 'fabia bazar praha'],
  },
  {
    id: 'rpg-specific-gap',
    language: 'cs' as const,
    focus: 'RPG hry: návody, recenze a novinky',
    audience: 'hráči RPG',
    articles: [
      {
        title: 'Jak začít v Baldur’s Gate 3',
        excerpt: 'Začátečnický průvodce: rasa, povolání, základní boj a dialogy. Neřeší multiclass.',
      },
    ],
    candidates: [
      query('baldurs gate 3 multiclass paladin warlock', [page('Paladin / Warlock multiclass guide', 'builds')], 300),
      query('baldurs gate 3 začátečník', [page('Jak začít hrát Baldur’s Gate 3', 'beginner')], 3000),
      query('gta 6 nejlepší auta', [page('Nejlepší auta v GTA', 'gta')], 15000),
      query(
        'zaklínač 4 série',
        [
          page(
            'Čtvrtá řada seriálu Zaklínač na Netflixu',
            'netflix',
            'Liam Hemsworth jako Geralt a datum premiéry nové řady.',
          ),
        ],
        1000,
      ),
      query('steam přihlášení', [page('Steam Login', 'login')], 100000),
    ],
    keep: ['baldurs gate 3 multiclass paladin warlock'],
    drop: ['baldurs gate 3 začátečník', 'gta 6 nejlepší auta', 'steam přihlášení', 'zaklínač 4 série'],
  },
  {
    id: 'candidate-cannibalisation',
    language: 'en' as const,
    focus: 'Home coffee brewing and practical espresso troubleshooting',
    audience: 'beginner home baristas',
    articles: [],
    candidates: [
      query('how to fix sour espresso', [page('Fixing sour espresso', 'sour')], 200),
      query('espresso tastes sour what to do', [page('Fixing sour espresso', 'sour')], 90),
      query('how to clean a steam wand', [page('Steam wand cleaning guide', 'clean')], 80),
    ],
    keep: ['how to fix sour espresso', 'how to clean a steam wand'],
    drop: ['espresso tastes sour what to do'],
  },
]

const results: unknown[] = []

describe.skipIf(process.env.AI_EVAL !== '1')('keyword opportunity eval', () => {
  beforeAll(() => {
    process.loadEnvFile?.('.env')
    const openAi = createOpenAI({ apiKey: process.env.NUXT_OPEN_AI_API_KEY })
    vi.stubGlobal('aiModel', (task: keyof typeof AI_MODELS) => openAi(AI_MODELS[task].id))
    vi.stubGlobal('recordAiUsage', async () => {})
  })
  afterAll(() => {
    const dir = join('tests', 'eval', '.results')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, `opportunity-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
      JSON.stringify(results, null, 2),
    )
    vi.unstubAllGlobals()
  })

  it.concurrent.each(cases)(
    '$id',
    async (testCase) => {
      const { accepted: decisions } = await assessOpportunities(
        { id: 'eval', language: testCase.language, focus: testCase.focus, audience: testCase.audience },
        testCase.candidates,
        testCase.articles,
      )
      const kept = decisions.map((decision) => testCase.candidates[decision.index]!.keyword)
      results.push({ id: testCase.id, kept, decisions })
      expect(kept.filter((keyword) => testCase.drop.includes(keyword))).toEqual([])
      expect([...kept].sort()).toEqual([...testCase.keep].sort())
      for (const decision of decisions) {
        expect(decision.angle.trim().length).toBeGreaterThan(10)
        expect(decision.reason.trim().length).toBeGreaterThan(10)
        expect(decision.reason).not.toMatch(/guaranteed|zaručen|\d+\s*(visits|visitors|návštěv)/i)
      }
    },
    120_000,
  )
})

beforeEach(stubImports)
