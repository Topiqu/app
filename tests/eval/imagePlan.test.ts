// @vitest-environment node
/**
 * Live eval of the picture plan for a saved article (`repickArticleImages`) on real demo articles. Costs real
 * tokens, so it is skipped unless AI_EVAL=1: `bun run eval:ai`. Every pair of look-alike pictures that reached a
 * blog belongs here as a case.
 */
import { join } from 'node:path'
import { wrapLanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(import('../../server/utils/ai/articleConfig'), 'imageRules')
}

await stubImports()

const { repickArticleImages } = await import('../../server/utils/ai/articleImages')
const { AI_MODELS } = await import('../../server/utils/ai/modelRegistry')

const figure = '<figure class="article-image"><img src="https://cdn.test/old.webp" alt="Ilustrační obrázek."></figure>'
type Plan = { subject: string; cover: string; slots: string[] }
type Case = {
  id: string
  title: string
  excerpt: string
  content: string
  otherCovers: { article: string; cover: string }[]
  /** Why the plan fails, or null when it passes. */
  fault: (plan: Plan) => string | null
}

const coffeeCovers = {
  price: { article: 'Kdy se domácí kávovar vyplatí oproti kavárně?', cover: 'Kaffeno K3 coffee machine' },
  descaling: { article: 'Odvápnění kávovaru: kolik stojí a co ušetří', cover: 'limescale deposit inside kettle' },
  milk: { article: 'Jak vybrat automatický kávovar podle mléčného systému', cover: 'cappuccino cup milk foam' },
}

const cases: Case[] = [
  {
    id: 'another coffee machine model is not a different cover',
    title: 'Jak vybrat automatický kávovar podle mléčného systému',
    excerpt:
      'Tryska, hadička, nebo nádobka? Porovnejte pohodlí, ceny kávovarů a cenu přípravku na čištění mléčné cesty.',
    content: `<h2>Mléčný systém vybírejte podle počtu nápojů</h2><p>Když řešíte, jak vybrat automatický kávovar, začněte u toho, kolik cappuccin a latté doma skutečně připravíte. Parní tryska stojí méně a hodí se na občasné napěnění mléka. Automatická hadička nebo nádobka šetří práci při přípravě, zato přidávají součásti k čištění. Z naší nabídky stojí Kaffeno K3 s tryskou 9 990 Kč, Kaffeno K5 Milk s nádobkou 14 490 Kč a Vellora Duo s hadičkou 18 990 Kč.</p>${figure}<h2>Tryska: méně součástí, více ruční práce</h2><p>Parní tryska vhání páru do mléka v samostatné nádobce. Pěnu připravujete ručně.</p><h2>Hadička: mléko z vlastní nádoby</h2><p>Automatická hadička nasává mléko z vámi zvolené nádoby. Je potřeba udržovat čistou hadičku i části, kterými mléko prochází. Vellora Duo připravuje dva šálky najednou.</p>${figure}<h2>Nádobka: pohodlí za cenu dalšího mytí</h2><p>Kaffeno K5 Milk má automatický systém s nádobkou o objemu 0,5 l.</p>`,
    otherCovers: [coffeeCovers.price, coffeeCovers.descaling],
    fault: ({ subject, cover, slots }) =>
      /coffee machine|espresso machine|kávovar/i.test(`${subject} ${cover}`)
        ? 'the cover is a coffee machine again'
        : slots.filter((query) => /(coffee|espresso) machine$/i.test(query.trim())).length > 1
          ? 'two coffee machines in one article'
          : null,
  },
  {
    id: 'the cover and the pictures of one article never show beans twice',
    title: 'Jakou zrnkovou kávu vybrat do automatického kávovaru?',
    excerpt:
      'Suchá zrna, vhodné pražení a správná dávka: vyberte kávu do automatu a spočítejte si cenu šálku včetně údržby.',
    content: `<h2>Podle povrchu zrn poznáte, zda jsou vhodná</h2><p>Jsou zrna suchá, bez výrazně mastného povrchu a bez přidané příchuti? Pak jsou dobrým výchozím bodem. Pro první balení sáhněte po středním nebo středně tmavém pražení. Pokud jsou zrna velmi tmavá a lesklá od oleje, vyberte raději jiná. Olej se může usazovat v mlýnku a spařovací jednotce.</p>${figure}<p>Do zásobníku nasypte běžná neochucená zrna. Cukr nebo sirup přidejte až do hotového nápoje.</p><h2>Údržbu zvolte podle filtru a mléčného systému</h2><p>Při běžném provozu s filtrem počítejte přibližně se dvěma odvápněními ročně. Při tvrdé vodě bez filtru může být potřeba odvápňovat každé jeden až dva měsíce.</p>${figure}<p>U kávovaru s mléčným systémem po přípravě propláchněte mléčnou cestu.</p>`,
    otherCovers: [coffeeCovers.price, coffeeCovers.descaling, coffeeCovers.milk],
    fault: ({ cover, slots }) =>
      [cover, ...slots].filter((query) => /bean/i.test(query) && !/bag|pack|jar|hopper/i.test(query)).length > 1
        ? 'loose beans appear twice'
        : null,
  },
  {
    id: 'a noise meter cover already on the blog is not repeated',
    title: 'Jak odhadnout hluk tepelného čerpadla u sousedů?',
    excerpt:
      'Akustický výkon a tlak nelze porovnávat přímo. Ukážeme na příkladech, co říkají o jednotce a jak odhadnout hluk u sousedova okna.',
    content: `<h2>Akustický výkon a tlak popisují různé věci</h2><p>Hluk tepelného čerpadla u sousedů závisí na umístění jednotky i vzdálenosti okna. Akustický výkon charakterizuje zdroj zvuku, zatímco akustický tlak popisuje hladinu v určitém místě.</p><h2>Dvě jednotky při stejných podmínkách</h2><p>Naše jednotky HW-8 a HW-12 ukazují rozdíl mezi katalogovými veličinami. V nočním režimu klesá u HW-8 přepočtený tlak v 5 m na 28 dB(A).</p>${figure}<h2>Jak přiblížit odhad sousedovu oknu</h2><p>Nejprve změřte vzdálenost od plánované venkovní jednotky k nejbližšímu sousedovu oknu. Potom zaznamenejte, zda bude čerpadlo stát ve volném prostoru, u zdi nebo v koutě.</p>`,
    otherCovers: [
      {
        article: 'Kam umístit tepelné čerpadlo, aby nerušilo sousedy',
        cover: 'sound level meter measuring noise in garden',
      },
      { article: 'Tepelné čerpadlo do starého domu: kdy se vyplatí?', cover: 'Czech old stone family house facade' },
      { article: 'Tepelné čerpadlo v mrazu: kdy při −15 °C dotápí?', cover: 'outdoor thermometer frost winter' },
    ],
    fault: ({ subject, cover, slots }) =>
      /sound level meter|noise meter|zvukoměr|hlukoměr/i.test(`${subject} ${cover}`)
        ? 'the noise meter cover again'
        : [cover, ...slots].some((query) => /diagram|chart|infographic|graph/i.test(query))
          ? 'a diagram, which a picture without text cannot show'
          : null,
  },
]

const results: unknown[] = []

describe.skipIf(process.env.AI_EVAL !== '1')('image plan eval', () => {
  beforeAll(() => {
    if (existsSync('.env')) process.loadEnvFile('.env')
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    // Production adds room for thinking on top of the answer budget (`server/utils/ai/models.ts`).
    vi.stubGlobal('aiModel', (task: keyof typeof AI_MODELS) =>
      wrapLanguageModel({
        model: anthropic(AI_MODELS[task].id),
        middleware: {
          transformParams: async ({ params }) => ({ ...params, maxOutputTokens: (params.maxOutputTokens ?? 0) + 8000 }),
        },
      }),
    )
  })

  afterAll(() => {
    const dir = join('tests', 'eval', '.results')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `image-plan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(results, null, 2))
    console.info(`eval results: ${file}`)
    vi.unstubAllGlobals()
  })

  it.each(cases)(
    '$id',
    async ({ id, title, excerpt, content, otherCovers, fault }) => {
      vi.stubGlobal('prisma', {
        article: {
          findMany: async () =>
            otherCovers.map(({ article, cover }) => ({ title: article, coverMedia: { name: cover } })),
        },
      })
      let plan: Plan | undefined
      vi.stubGlobal(
        'finalizeArticle',
        async (
          object: { coverImage: { query: string }; images: { query: string }[] },
          _language: string,
          { coverSubject }: { coverSubject: string },
        ) => {
          plan = {
            subject: coverSubject,
            cover: object.coverImage.query,
            slots: object.images.map((image) => image.query),
          }
          return { articleImageUrl: '', articleCoverMediaId: null }
        },
      )
      await repickArticleImages('site', { id, title, excerpt, content, language: 'cs', published: true })
      const problem = fault(plan!)
      results.push({ id, plan, problem })
      console.info(id, plan, problem ?? 'ok')
      expect(problem).toBeNull()
    },
    120_000,
  )
})

beforeEach(stubImports)
