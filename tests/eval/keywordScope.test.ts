// @vitest-environment node
/**
 * Live eval of the relevance gate (`inScope`) on real headlines and search phrases. Costs real tokens,
 * so it is skipped unless AI_EVAL=1: `bun run eval:ai`. `either` items are ambiguous and not scored.
 */
import { join } from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import { mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/ai/reasoning'), 'aiReasoning')
}

await stubImports()

const { inScope } = await import('../../server/utils/keywords/scope')
const { AI_MODELS } = await import('../../server/utils/ai/modelRegistry')

type Verdict = 'keep' | 'drop' | 'either'
type Blog = {
  id: string
  focus: string
  audience: string
  keywords: string[]
  items: [string, Verdict][]
}

const blogs: Blog[] = [
  {
    id: 'rpg-games',
    focus: 'RPG hry: recenze, novinky a návody pro hráče RPG',
    audience: 'čeští hráči RPG her',
    keywords: ['RPG', 'Kingdom Come', 'Zaklínač'],
    items: [
      ['Zaklínač 3 Remastered dostal první patch. CD Projekt upravuje nasvícení (cz.ign.com)', 'keep'],
      ['Kingdom Come: Deliverance II má konečně multiplayer (cnews.cz)', 'keep'],
      [
        'Hra Exodus má datum vydání (hrej.cz) — Sci-fi RPG od bývalých tvůrců Mass Effectu vyjde na jaře, hráči v něm povedou vlastní dynastii.',
        'keep',
      ],
      ['Obsidian ohlásil nové RPG ze světa Pillars of Eternity (games.cz)', 'keep'],
      ['GTA VI ukázalo nový trailer (refresher.cz) — Rockstar ukázal další záběry z Vice City.', 'drop'],
      ['Call of Duty: nová sezóna přináší tři mapy a nový battle pass (games.cz)', 'drop'],
      ['EA Sports FC 27 odhalilo hodnocení hráčů (sport.cz)', 'drop'],
      ['Herec z Kingdom Come si otevřel v Praze hospodu (seznamzpravy.cz)', 'either'],
    ],
  },
  {
    id: 'affordable-cars',
    focus: 'Dostupná auta pro běžné rodiny: levné nové i ojeté vozy, ceny a srovnání',
    audience: 'rodiny vybírající první nebo levné auto',
    keywords: ['levná auta', 'Dacia', 'ojetá auta'],
    items: [
      ['Dacia Sandero má nový ceník, základ pod 300 tisíc (auto.cz)', 'keep'],
      ['Škoda Fabia zlevnila o 40 tisíc korun (autorevue.cz)', 'keep'],
      ['Nejspolehlivější ojetiny do 200 tisíc podle TÜV reportu (garaz.cz)', 'keep'],
      ['Koenigsegg ukázal limitovanou edici za 70 milionů (auto.cz)', 'drop'],
      ['Nové BMW M5 má 727 koní (autoforum.cz)', 'drop'],
      ['Ferrari představilo nový hypersport (auto-mania.cz)', 'drop'],
      ['Nové BMW řady 3 má české ceny, základ stojí 1,2 milionu (autorevue.cz)', 'drop'],
      ['nejlevnější nová auta 2026', 'keep'],
      ['dacia sandero cena', 'keep'],
      ['koenigsegg cena', 'drop'],
      ['lamborghini urus', 'drop'],
    ],
  },
  {
    id: 'bmw',
    focus: 'BMW: novinky, modely a technika bavorské značky',
    audience: 'fanoušci a majitelé BMW',
    keywords: ['BMW'],
    items: [
      ['Nové BMW řady 3 má české ceny (autorevue.cz)', 'keep'],
      ['BMW spustilo sériovou výrobu baterií Gen6 v novém bavorském závodě (auto.cz)', 'keep'],
      ['Dacia Sandero má nový ceník (auto.cz)', 'drop'],
      ['Koenigsegg ukázal limitovanou edici (auto.cz)', 'drop'],
      ['Mercedes CLA dostal nový čtyřválec (autoforum.cz)', 'drop'],
      [
        'Nepřesvědčivý a nepřesvědčivější: Němci proti sobě postavili dostupné modely BMW a Mercedesu (autoforum.cz)',
        'keep',
      ],
    ],
  },
  {
    id: 'czechoslovak-politics',
    focus: 'Československá politika: dění v české a slovenské politice',
    audience: 'čtenáři sledující českou a slovenskou politiku',
    keywords: ['Sněmovna', 'vláda', 'slovenská politika'],
    items: [
      ['Sněmovna schválila rozpočet na příští rok (irozhlas.cz)', 'keep'],
      ['Fico odvolal ministra zdravotnictví (aktuality.sk)', 'keep'],
      ['Prezident jmenoval nového ministra zahraničí (novinky.cz)', 'keep'],
      ['Babiš jednal v Bruselu o migračním paktu (ct24.cz)', 'keep'],
      ['V Ugandě vypukla revoluce, armáda obsadila parlament (idnes.cz)', 'drop'],
      ['Trump oznámil nová cla na evropská auta (ct24.cz)', 'either'],
      ['Thálie získaly své majitele, politika šla stranou (expres.cz)', 'drop'],
      ['Markéta Pekarová Adamová rok bez politiky: otevřeně o zdraví a práci (blesk.cz)', 'either'],
    ],
  },
]

// The examples the gate exists for: a pass that keeps any of them fails regardless of the score.
const MUST_DROP = ['GTA VI', 'Koenigsegg ukázal limitovanou edici za 70 milionů', 'V Ugandě vypukla revoluce']

const results: unknown[] = []

describe.skipIf(process.env.AI_EVAL !== '1')('keyword scope eval', () => {
  beforeAll(() => {
    process.loadEnvFile?.('.env')
    const openAi = createOpenAI({ apiKey: process.env.NUXT_OPEN_AI_API_KEY })
    vi.stubGlobal('aiModel', (task: keyof typeof AI_MODELS) => openAi(AI_MODELS[task].id))
    vi.stubGlobal('recordAiUsage', async () => {})
  })

  afterAll(() => {
    const dir = join('tests', 'eval', '.results')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `scope-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(results, null, 2))
    console.info(`eval results: ${file}`)
    vi.unstubAllGlobals()
  })

  it.concurrent.each(blogs)(
    '$id',
    async (blog) => {
      const kept = new Set(
        await inScope(
          { id: 'eval', language: 'cs', focus: blog.focus, audience: blog.audience, keywords: blog.keywords },
          blog.items.map(([item]) => item),
          'EVAL',
        ),
      )
      const verdicts = blog.items.map(([item, expected], index) => ({ item, expected, kept: kept.has(index) }))
      const scored = verdicts.filter((verdict) => verdict.expected !== 'either')
      const wrong = scored.filter((verdict) => verdict.kept !== (verdict.expected === 'keep'))
      results.push({ id: blog.id, wrong, verdicts })
      console.info(
        blog.id,
        `${scored.length - wrong.length}/${scored.length}`,
        wrong.map((verdict) => verdict.item),
      )

      expect(
        verdicts.filter((verdict) => verdict.kept && MUST_DROP.some((text) => verdict.item.includes(text))),
      ).toEqual([])
      expect(wrong.length).toBeLessThanOrEqual(1)
    },
    120_000,
  )
})

beforeEach(stubImports)
