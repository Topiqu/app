// @vitest-environment node
import { join } from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import { mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { AI_MODELS } from '../../server/utils/ai/modelRegistry'
import { refreshKeywordPlan } from '../../server/utils/keywords/plan'
import { keywordOpportunity } from '../../shared/utils/keywordOpportunity'

// Opt-in provider smoke: real search data and AI, with all database writes replaced by an in-memory plan.
const sites = [
  {
    id: 'coffee',
    language: 'cs' as const,
    focus: 'Domácí příprava espressa a kávy: praktické návody pro začátečníky',
    audience: 'začínající domácí baristé',
    keywords: ['espresso', 'káva', 'mlýnek'],
  },
  {
    id: 'affordable-cars',
    language: 'cs' as const,
    focus: 'Dostupná auta pro běžné rodiny: levné nové a ojeté vozy, ceny a srovnání',
    audience: 'rodiny vybírající levné auto',
    keywords: ['levná auta', 'Dacia', 'ojetá auta'],
  },
  {
    id: 'rpg-games',
    language: 'cs' as const,
    focus: 'RPG hry: praktické návody, recenze a novinky pro hráče RPG',
    audience: 'čeští hráči RPG',
    keywords: ['RPG', 'Kingdom Come', 'Zaklínač'],
  },
]
const results: unknown[] = []
const rows: Record<string, unknown>[] = []
let sandbox: string | undefined

describe.skipIf(process.env.AI_EVAL !== '1' || process.env.DATAFORSEO_EVAL !== '1')('live keyword discovery', () => {
  beforeAll(() => {
    process.loadEnvFile?.('.env')
    sandbox = process.env.DATAFORSEO_SANDBOX
    process.env.DATAFORSEO_SANDBOX = '0'
    const openAi = createOpenAI({ apiKey: process.env.NUXT_OPEN_AI_API_KEY })
    vi.stubGlobal('aiModel', (task: keyof typeof AI_MODELS) => openAi(AI_MODELS[task].id))
    vi.stubGlobal('recordAiUsage', async () => {})
    vi.stubGlobal('logAction', async (entry: unknown) => results.push(entry))
    const tx = {
      keywordCluster: {
        create: async ({ data }: { data: Record<string, unknown> }) => rows.push(data),
        deleteMany: async () => {},
      },
      clientSite: { update: async () => {} },
    }
    vi.stubGlobal('prisma', {
      article: { findMany: async () => [] },
      keywordCluster: { findMany: async () => [] },
      $transaction: async (run: (value: typeof tx) => unknown) => run(tx),
    })
  })
  afterAll(() => {
    const dir = join('tests', 'eval', '.results')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, `discovery-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
      JSON.stringify({ results, rows }, null, 2),
    )
    if (sandbox === undefined) delete process.env.DATAFORSEO_SANDBOX
    else process.env.DATAFORSEO_SANDBOX = sandbox
    vi.unstubAllGlobals()
  })

  it.each(sites)(
    '$id produces grounded actionable topics from real Czech search data',
    async (site) => {
      const count = await refreshKeywordPlan(site)
      const plan = rows.filter((row) => row.clientSiteId === site.id)
      console.info(
        site.id,
        `${count} topics`,
        plan.map((row) => row.keyword),
      )
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThanOrEqual(30)
      expect(plan.some((row) => keywordOpportunity(row.opportunity)?.organic.length)).toBe(true)
      expect(new Set(plan.map((row) => row.keyword)).size).toBe(plan.length)
      expect(plan.some((row) => keywordOpportunity(row.opportunity)?.specificity === 'focused')).toBe(true)
      if (site.id === 'rpg-games')
        expect(plan.filter((row) => /série|netflix|seriál/i.test(String(row.keyword)))).toEqual([])
      for (const row of plan) {
        expect(keywordOpportunity(row.opportunity)).not.toBeNull()
        expect(row.volume).toBeGreaterThanOrEqual(0)
      }
    },
    180_000,
  )
})
