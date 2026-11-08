// @vitest-environment node
/**
 * Live eval of an article grounded in a real product feed: does the writer take the product the brief names,
 * write the publisher's offer in its own voice, and how long does it think before its first token?
 * Costs real tokens: `AI_EVAL=1 FEED_XML=<Heureka export on disk> vitest run tests/eval/knowledgeArticle.test.ts`.
 */
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { FeedProduct } from '../../server/utils/knowledge/feed'
import type { KnowledgeCandidate } from '../../server/utils/knowledge/retrieve'

import { stubArticlePipeline } from './articlePipeline'
import { htmlToText } from '../../shared/utils/articleBlocks'

vi.mock('../../server/utils/ai/openai', async () => {
  const { createOpenAI } = await import('@ai-sdk/openai')
  return { default: createOpenAI({ apiKey: process.env.NUXT_OPEN_AI_API_KEY }) }
})

vi.mock('../../server/utils/ai/anthropic', async () => {
  const { createAnthropic } = await import('@ai-sdk/anthropic')
  return { default: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) }
})

await stubArticlePipeline()

const { streamArticle } = await import('../../server/utils/ai/article')
const { articleWriterStream } = await import('../../server/utils/ai/articleStream')
const { collectFeedProducts, parseKnowledgeFeed } = await import('../../server/utils/knowledge/feed')
const { formatKnowledgeBrief, knowledgeLinkTargets, knowledgeUsage, namedProducts } =
  await import('../../server/utils/knowledge/retrieve')

/** The endpoint's limits, to report whether a run would have been cut. */
const LIMITS = { thinkingMs: 240_000, writingMs: 300_000, before: 120_000 }

type Case = {
  id: string
  prompt: string
  format: 'comparison' | 'guide'
  /** Feed product names the retrieval shortlist would hold, matched as a prefix. */
  shortlist: string[]
  named?: { product: string; price: string; variant: string }
  /** Feed figures the article must keep, and figures only a sibling variant or the web gives. */
  figures?: { kept: RegExp[]; borrowed: RegExp[] }
  expectAny?: string[]
}

const comparison = {
  format: 'comparison' as const,
  prompt: `Peletová kamna do rodinného domu: teplovzdušná, nebo s výměníkem do ústředního topení?

Článek pro majitele rodinného domu (120–180 m²), který zvažuje peletová kamna jako hlavní nebo doplňkový zdroj tepla. Hlavním doporučením je LINCAR OLGA 501 L s rozvodem teplého vzduchu. Porovnej ji s teplovodními modely Kalor Marta 20 idro a Kalor Ilaria 24 idro.

Vysvětli:
- kdy stačí teplovzdušná kamna a kdy dává smysl výměník napojený na radiátory
- jak dimenzovat výkon podle prostoru
- co obnáší provoz: zásobník, doplňování pelet, čištění, spotřeba elektřiny
- co je potřeba k instalaci, hlavně kouřovod pro peletová kamna (80 vs. 100 mm)

Do tabulky dej výkon, vytápěný prostor, objem zásobníku, typ rozvodu tepla a cenu. Na závěr dej jasné doporučení, pro koho je který model.`,
  shortlist: [
    'LINCAR OLGA 501 L',
    'LINCAR MONELLA 940/SA',
    'Kalor Marta 20 idro',
    'Kalor Ilaria 24 idro',
    'Kalor Ilaria 24 DD Idro AUTO',
    'Roura 80/1500 mm',
    'Roura 100/1000mm',
  ],
  named: { product: 'Ilaria 24 idro', price: '107 488', variant: 'DD Idro AUTO' },
  // OLGA's feed entry: 17 kg hopper, 230 m³. The feed gives no hopper for Marta or Ilaria 24 idro; 38 kg is
  // the AUTO variant's, and 17,5 kg, 228 m³ and 25–42 kg come from manuals and other shops.
  figures: {
    kept: [/\b17\s?kg/, /\b230\s?m[³3]/],
    borrowed: [/\b(?:25|38|42)\s?(?:[–-]\s?\d+\s?)?kg/, /\b17,5\s?kg/, /\b228\s?m[³3]/],
  },
}

const cases: Case[] = [
  { id: 'comparison-1', ...comparison },
  { id: 'comparison-2', ...comparison },
  {
    id: 'insert-unnamed',
    format: 'guide',
    prompt: 'Jak vybrat krbovou vložku na pelety do stávajícího krbu',
    shortlist: ['Kalor Paola 13', 'Kalor Chiara 15', 'LINCAR OLGA 501 L', 'Roura 80/1500 mm', 'Koleno 80/90'],
    expectAny: ['Paola 13', 'Chiara 15'],
  },
]

const VENDOR_CLAIMS =
  /naše nabídka uvádí|v naší nabídce se uvádí|dle výrobce|výrobce uvádí|podle prodejc[eů]|česká nabídka|(?:někteří )?prodejci uvádějí|uvádějí (?:někteří )?prodejci/gi

const candidate = (product: FeedProduct, index: number): KnowledgeCandidate => ({
  id: `chunk-${index}`,
  sourceId: 'feed',
  version: 1,
  title: 'Produkty Centrum vytápění',
  publicUrl: product.url,
  indexedAt: new Date(),
  validAsOf: null,
  fetchedAt: new Date(),
  content: product.text,
  similarity: 0.6,
  lexicalRank: index + 1,
  score: 0.05,
  productId: product.externalId,
  productName: product.name,
  price: product.price,
  currency: product.currency,
  availability: product.availability,
})

const seconds = (ms: number | null) => (ms === null ? null : Math.round(ms / 100) / 10)
const flat = (text: string) => text.replace(/\s+/g, ' ')
const results: unknown[] = []
let catalog: FeedProduct[] = []

describe.skipIf(process.env.AI_EVAL !== '1' || !process.env.FEED_XML)('knowledge article eval', () => {
  beforeAll(async () => {
    process.loadEnvFile?.('.env')
    const models = await import('../../server/utils/ai/models')
    vi.stubGlobal('aiModel', models.aiModel)
    vi.stubGlobal('aiWebSearchTool', models.aiWebSearchTool)
    vi.stubGlobal('reportCaughtError', async (message: string) => console.warn(message))
    catalog = collectFeedProducts(
      parseKnowledgeFeed(readFileSync(process.env.FEED_XML!, 'utf8'), 'CZK'),
      20_000,
    ).products
    vi.stubGlobal('prisma', {
      clientSite: {
        findFirstOrThrow: async () => ({
          name: 'Centrum vytápění',
          domain: 'centrumvytapeni.cz',
          websiteUrl: 'https://www.centrumvytapeni.cz',
          plan: 'PREMIUM',
          features: [],
          language: 'cs',
          focus: 'Vytápění rodinných domů: krbová a peletová kamna, kotle, kouřovody',
          keywords: [],
          audience: null,
          tags: [],
          aiToneOfVoice: null,
          aiControversyLevel: 'LOW',
          articleQuality: 'STANDARD',
          communityInsight: null,
        }),
      },
    })
  })

  afterAll(() => {
    const dir = join('tests', 'eval', '.results')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `knowledge-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(results, null, 2))
    console.info(`eval results: ${file}`)
    vi.unstubAllGlobals()
  })

  it.each(cases)(
    '$id',
    async (item) => {
      const shortlist = item.shortlist.map((prefix, index) => {
        const product = catalog.find((entry) => entry.name.startsWith(prefix))
        if (!product) throw new Error(`feed has no product starting with ${prefix}`)
        return candidate(product, index)
      })
      const named = namedProducts(shortlist, item.prompt)
      const selected = [...named, ...shortlist.filter((entry) => !named.includes(entry))]
      vi.stubGlobal('retrieveKnowledge', async () => ({
        brief: formatKnowledgeBrief(selected, new Date(), 'cs', named),
        publicUrls: [...new Set(selected.flatMap((entry) => (entry.publicUrl ? [entry.publicUrl] : [])))],
        linkTargets: knowledgeLinkTargets(selected),
        used: knowledgeUsage(selected),
        names: selected.map((entry) => entry.productName ?? entry.title),
        tokens: 0,
      }))

      const startedAt = Date.now()
      const generation = await streamArticle('eval', item.prompt, {
        format: item.format,
        language: 'cs',
        modules:
          item.format === 'comparison' ? ['answer', 'takeaways', 'faq', 'table'] : ['answer', 'takeaways', 'faq'],
        allowGeneratedImages: false,
      })
      const writerAt = Date.now()
      let firstTextAt: number | null = null
      for await (const part of articleWriterStream(generation.result)) {
        if (part.type === 'error') throw part.error
        if (part.type === 'partial') firstTextAt ??= Date.now()
      }
      const writtenAt = Date.now()
      const draft = await generation.result.output
      const final = await generation.review(structuredClone(draft))
      const reviewedAt = Date.now()

      const text = flat(htmlToText(final.content))
      const readable = (article: typeof final) =>
        flat(
          [
            article.title,
            article.perex,
            htmlToText(article.content),
            article.answer,
            ...article.keyTakeaways,
            ...article.faq.flatMap(({ question, answer }) => [question, answer]),
          ].join(' '),
        )
      const everything = readable(final)
      const written = readable(draft)
      const matches = (patterns: RegExp[], where: string) =>
        patterns.flatMap((pattern) => where.match(pattern)?.[0] ?? [])
      const thinkingMs = firstTextAt === null ? null : firstTextAt - writerAt
      const writingMs = firstTextAt === null ? null : writtenAt - firstTextAt
      const entry = {
        id: item.id,
        named: named.map((entry) => entry.productName),
        timings: {
          researchS: seconds(writerAt - startedAt),
          thinkingS: seconds(thinkingMs),
          writingS: seconds(writingMs),
          writerS: seconds(writtenAt - writerAt),
          reviewS: seconds(reviewedAt - writtenAt),
          totalS: seconds(reviewedAt - startedAt),
        },
        limits: {
          thinkingOk: thinkingMs !== null && thinkingMs <= LIMITS.thinkingMs,
          writingOk: writingMs !== null && writingMs <= LIMITS.writingMs,
          cutByOldLimit: writtenAt - writerAt > LIMITS.before,
        },
        words: text.split(' ').filter(Boolean).length,
        modules: {
          answer: Boolean(final.answer),
          takeaways: final.keyTakeaways.length,
          faq: final.faq.length,
          table: /<table\b/i.test(final.content),
        },
        namedProduct: item.named && {
          used: everything.includes(item.named.product),
          price: everything.includes(item.named.price),
          variantMentioned: everything.includes(item.named.variant),
        },
        figures: item.figures && {
          missing: item.figures.kept.filter((pattern) => !pattern.test(everything)).map(String),
          borrowed: matches(item.figures.borrowed, everything),
          borrowedByWriter: matches(item.figures.borrowed, written),
        },
        expectedAny: item.expectAny?.filter((name) => everything.includes(name)),
        vendorClaims: [...everything.matchAll(VENDOR_CLAIMS)].map(([match]) => match),
        vendorClaimsByWriter: [...written.matchAll(VENDOR_CLAIMS)].map(([match]) => match),
        review: {
          approved: generation.editorialReview?.approved,
          revised: generation.editorialReview?.revised,
          issues: generation.editorialReview?.issues.map(({ code, key, blocking, note }) => ({
            code,
            key,
            blocking,
            note,
          })),
          verification: generation.editorialReview?.verification,
        },
        draft: { content: draft.content },
        final: { title: final.title, perex: final.perex, answer: final.answer, content: final.content },
      }
      results.push(entry)
      const { draft: _draft, final: _final, ...summary } = entry
      console.info(JSON.stringify(summary, null, 2))

      if (item.named) expect(entry.namedProduct?.used).toBe(true)
      if (item.figures) expect(entry.figures).toMatchObject({ missing: [], borrowed: [] })
      expect(entry.vendorClaims).toEqual([])
      if (item.expectAny) expect(entry.expectedAny?.length).toBeGreaterThan(0)
    },
    1_200_000,
  )
})

beforeEach(stubArticlePipeline)
