// @vitest-environment node
import { join } from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import { mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import snapshots from './keywordSerps.json'
import { AI_MODELS } from '../../server/utils/ai/modelRegistry'
import { assessOpportunities } from '../../server/utils/keywords/opportunity'

const profiles = {
  coffee: {
    focus: 'Domácí příprava espressa a kávy: praktické návody pro začátečníky',
    audience: 'začínající domácí baristé',
    drop: ['espresso macchiato'],
  },
  'affordable-cars': {
    focus: 'Dostupná auta pro běžné rodiny: levné nové a ojeté vozy, ceny a srovnání',
    audience: 'rodiny vybírající levné auto',
    drop: [],
  },
  'rpg-games': {
    focus: 'RPG hry: praktické návody, recenze a novinky pro hráče RPG',
    audience: 'čeští hráči RPG',
    drop: ['zaklínač 4 série', 'zaklínač 4 série recenze'],
  },
}
const results: unknown[] = []

// Real Czech queries and SERPs captured on snapshots.capturedAt. Replaying incurs AI cost only.
describe.skipIf(process.env.AI_EVAL !== '1')('captured Czech SERP opportunities', () => {
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
      join(dir, `serps-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
      JSON.stringify(results, null, 2),
    )
    vi.unstubAllGlobals()
  })
  it.concurrent.each(snapshots.groups)(
    '$id',
    async (group) => {
      const profile = profiles[group.id as keyof typeof profiles]
      const decisions = await assessOpportunities({ id: 'eval', language: 'cs', ...profile }, group.candidates, [])
      const kept = decisions.map((decision) => group.candidates[decision.index]!.keyword)
      results.push({ id: group.id, capturedAt: snapshots.capturedAt, kept, decisions })
      expect(kept.length).toBeGreaterThan(0)
      expect(kept.filter((keyword) => profile.drop.includes(keyword))).toEqual([])
      expect(decisions.some((decision) => decision.specificity === 'focused')).toBe(true)
    },
    120_000,
  )
})
