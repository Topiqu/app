// @vitest-environment node
/**
 * Live eval of a legal duty widened beyond its condition, from a published EUDR guide: non-SME downstream
 * operators verify upstream due diligence only on a substantiated concern. The verifier suggested adding
 * the duty without that condition, the copy desk asked for it and the revision wrote it in.
 * Costs real tokens: `AI_EVAL=1 vitest run tests/eval/obligationScope.test.ts`.
 */
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { stubArticlePipeline } from './articlePipeline'

vi.mock('../../server/utils/ai/openai', async () => {
  const { createOpenAI } = await import('@ai-sdk/openai')
  return { default: createOpenAI({ apiKey: process.env.NUXT_OPEN_AI_API_KEY }) }
})

vi.mock('../../server/utils/ai/anthropic', async () => {
  const { createAnthropic } = await import('@ai-sdk/anthropic')
  return { default: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) }
})

await stubArticlePipeline()

const { recheckRevision, reviewArticle } = await import('../../server/utils/ai/articleQuality')

const sources = [
  'https://green-forum.ec.europa.eu/nature-and-biodiversity/deforestation-regulation-implementation/understand-due-diligence_en',
  'https://trade.ec.europa.eu/access-to-markets/en/news/delay-until-december-2026-and-other-developments-implementation-eudr-regulation',
  'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202502650',
]
const researchBrief = `Sources:\n${sources.join('\n')}`
const knowledgeBrief =
  '[K1] "eudr-pracovni-skupina-2026-10-28.md" (internal) · Máme 85 zaměstnanců. Část dubového a bukového řeziva nakupujeme od dodavatelů v EU, kteří ho uvedli na trh; bukové řezivo z Bosny a Hercegoviny dovážíme sami.'

const checkpoint =
  '<p><strong>Kontrolní bod pro navazující subjekty mimo kategorii malých a středních podniků:</strong> Ověřte, že předchozí článek řetězce provedl náležitou péči a že riziko je zanedbatelné. Tyto subjekty se také musí registrovat v informačním systému.</p>'
const section = (extra: string) =>
  `<h2>Ověřte termín pro sebe i pro dodavatele</h2><p>Pravidla se použijí od 30. 12. 2026. Stejné datum se týká také navazujících subjektů a obchodníků všech velikostí.</p><h2>Zařaďte výrobek a určete svou roli</h2><p>U dřeva již pokrytého příslušným prohlášením je výrobce navazujícím subjektem. Navazující subjekty podle upravených pravidel nepodávají vlastní prohlášení o náležité péči jen proto, že ze dřeva vyrábějí další výrobek.</p><h3>Dřevo nakoupené v Evropské unii</h3><p>Po dodavateli požadujte identifikaci dodávky, zemi původu a informaci, kdo zajišťuje příslušné prohlášení. Pokud už prohlášení vzniklo, vyžádejte si referenční údaj a propojte jej s nákupem a výrobní šarží.</p>${extra}<h3>Řezivo dovážené ze země mimo EU</h3><p>Jako dovozce připravte údaje o dodavateli, místě a době produkce, geolokaci pozemků a podklady k zákonnosti těžby. Následuje posouzení rizika a případně jeho zmírnění.</p>`

const draft = (extra = '') => ({
  title: 'EUDR a nábytek: co musí výrobce před první dodávkou?',
  perex: 'Co musí výrobce nábytku připravit podle nařízení o odlesňování, než poprvé dodá výrobek na trh EU.',
  content: section(extra),
  sources,
})
const context = { prompt: draft().title, format: 'guide', modules: [], researchBrief, knowledgeBrief }

/** A request to add an upstream due-diligence check without its substantiated-concern trigger. */
const widened = (text: string) =>
  /dopl[nň]|přidej|uveďte|\badd\b|include/i.test(text) &&
  /ověř|verif/i.test(text) &&
  /náležit|due diligence/i.test(text) &&
  /předchozí|upstream|dodavatel|supplier/i.test(text) &&
  !/podezř|pochybnost|concern|signál|indicat/i.test(text)

const results: unknown[] = []

describe.skipIf(process.env.AI_EVAL !== '1')('obligation scope eval', () => {
  beforeAll(async () => {
    if (existsSync('.env')) process.loadEnvFile('.env')
    const models = await import('../../server/utils/ai/models')
    vi.stubGlobal('aiModel', models.aiModel)
    vi.stubGlobal('aiWebSearchTool', models.aiWebSearchTool)
    vi.stubGlobal('reportCaughtError', async (message: string) => console.warn(message))
  })

  afterAll(() => {
    const dir = join('tests', 'eval', '.results')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `obligation-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(results, null, 2))
    console.info(`eval results: ${file}`)
    vi.unstubAllGlobals()
  })

  it('rejects an upstream check stated without its condition', async () => {
    const result = await reviewArticle(draft(checkpoint), { ...context, verifyFacts: true })
    results.push({ case: 'stated', ...result })
    console.info(result.verdicts)
    const flagged = result.review.issues.filter(
      (issue) => issue.key === 'correctClaim' && /předchozí článek/i.test(issue.params?.claim ?? ''),
    )
    expect(flagged.length).toBeGreaterThan(0)
    expect(result.review.approved).toBe(false)
  }, 300_000)

  // Production: a SUPPORTED verdict went on "add that non-SME downstream operators must verify…".
  it('never asks a revision to add the check without its condition', async () => {
    const result = await reviewArticle(draft(), { ...context, verifyFacts: true })
    results.push({ case: 'asked', ...result })
    console.info(result.verdicts)
    const lines = (result.verdicts ?? '').split('\n').filter(widened)
    const notes = result.review.issues.map((issue) => issue.note).filter(widened)
    // Practical advice that claims no legal requirement is not a duty to correct.
    const advice = result.review.issues.filter((issue) => /Po dodavateli požadujte/.test(issue.params?.claim ?? ''))
    expect({ lines, notes, advice }).toEqual({ lines: [], notes: [], advice: [] })
  }, 300_000)

  it('reports a duty a revision added without grounding', async () => {
    const original = draft()
    const after = original.content.replace(/(výrobní šarží\.<\/p>)/, `$1${checkpoint}`)
    const issues = [
      {
        code: 'missing_specifics' as const,
        note: 'Oddíl „Dřevo nakoupené v Evropské unii“ neuvádí povinnost navazujícího subjektu ověřit náležitou péči dodavatele. Doplňte ji jako samostatný kontrolní bod.',
        blocking: false,
      },
    ]
    const result = await recheckRevision({ ...original, content: after }, original, issues, context, [
      { before: '', after: checkpoint },
    ])
    results.push({ case: 'added', ...result })
    console.info(result.introduced)
    expect(result.introduced.length).toBeGreaterThan(0)
    expect(result.review.approved).toBe(false)
  }, 120_000)
})
