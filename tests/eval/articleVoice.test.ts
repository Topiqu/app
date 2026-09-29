// @vitest-environment node
/**
 * Live eval of the article pipeline (research → writer → verification → copy desk → revision).
 * Costs real tokens, so it is skipped unless AI_EVAL=1: `bun run eval:ai`.
 */
import { join } from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import { mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { ArticleFormat } from '../../server/utils/ai/formats'

import { hedges } from './hedging'
import { streamArticle } from '../../server/utils/ai/article'
import { AI_MODELS } from '../../server/utils/ai/modelRegistry'

type Case = {
  id: string
  prompt: string
  language: 'cs' | 'en'
  format: ArticleFormat
  controversy: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
  focus: string
  // A debunk or an unconfirmed status that is itself the news may legitimately say so.
  maxHedges: number
}

const cases: Case[] = [
  {
    id: 'story-premise',
    prompt:
      'Příběh stavebníka u Palkovic, kterému se kvůli územnímu plánu, povolení záměru a změnám stavebního zákona na dva roky zasekla stavba rodinného domu.',
    language: 'cs',
    format: 'story',
    controversy: 'LOW',
    focus: 'stavebnictví a bydlení',
    maxHedges: 0,
  },
  {
    id: 'unsupported-news',
    prompt: 'Babiš a Voluntia: udělal už nějaký krok?',
    language: 'cs',
    format: 'news',
    controversy: 'MEDIUM',
    focus: 'politika',
    maxHedges: 1,
  },
  {
    id: 'debunk',
    prompt: 'Je pravda, že od července 2024 už na stavbu rodinného domu nepotřebuju žádné povolení?',
    language: 'cs',
    format: 'analysis',
    controversy: 'NONE',
    focus: 'stavebnictví a bydlení',
    maxHedges: 2,
  },
  {
    id: 'opinion-high',
    prompt: 'Argue that a four-day work week would hurt small construction firms more than it helps them.',
    language: 'en',
    format: 'opinion',
    controversy: 'HIGH',
    focus: 'construction business',
    maxHedges: 0,
  },
  {
    id: 'games-news',
    prompt: 'The Witcher 4: what has CD Projekt actually said about the release date?',
    language: 'en',
    format: 'news',
    controversy: 'LOW',
    focus: 'video games',
    maxHedges: 1,
  },
]

const results: unknown[] = []

describe.skipIf(!process.env.AI_EVAL)('article voice eval', () => {
  beforeAll(() => {
    process.loadEnvFile?.('.env')
    const openAi = createOpenAI({ apiKey: process.env.NUXT_OPEN_AI_API_KEY })
    vi.stubGlobal('aiModel', (task: keyof typeof AI_MODELS) => openAi(AI_MODELS[task].id))
    vi.stubGlobal('aiWebSearchTool', (size: 'low' | 'medium' | 'high' = 'high') =>
      openAi.tools.webSearch({ searchContextSize: size }),
    )
    vi.stubGlobal('reportCaughtError', async (message: string, error: unknown) => console.warn(message, error))
  })

  afterAll(() => {
    const dir = join('tests', 'eval', '.results')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(file, JSON.stringify(results, null, 2))
    console.info(`eval results: ${file}`)
    vi.unstubAllGlobals()
  })

  it.concurrent.each(cases)(
    '$id',
    async (item) => {
      vi.stubGlobal('prisma', {
        clientSite: {
          findFirstOrThrow: async () => ({
            plan: 'PREMIUM',
            features: [],
            language: item.language,
            domain: 'eval.example.com',
            focus: item.focus,
            keywords: [],
            audience: null,
            tags: [],
            aiToneOfVoice: null,
            aiControversyLevel: item.controversy,
            communityInsight: null,
          }),
        },
      })
      const generation = await streamArticle('eval', item.prompt, {
        format: item.format,
        language: item.language,
        modules: ['answer', 'takeaways'],
        useKnowledge: false,
        allowGeneratedImages: false,
      })
      for await (const _ of generation.result.fullStream);
      const draft = await generation.result.object
      const final = await generation.review(structuredClone(draft))
      const found = {
        draft: hedges(draft.content),
        // The answer and takeaways restate the body by design; counting them would double-count.
        final: hedges(final.content),
      }
      results.push({
        id: item.id,
        hedges: found,
        review: generation.editorialReview,
        research: generation.research,
        title: final.title,
        content: final.content,
      })
      console.info(item.id, found.draft.length, '→', found.final.length, found.final)
      expect(found.final.length).toBeLessThanOrEqual(item.maxHedges)
    },
    900_000,
  )
})
