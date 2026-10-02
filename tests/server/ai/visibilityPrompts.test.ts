import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTO_PROMPT_LIMIT, seedVisibilityPrompts } from '../../../server/utils/ai/visibilityPrompts'

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

const site = { name: 'Blog', domain: 'blog.cz', focus: 'kávovary', audience: 'baristé', language: 'cs' }
let db: ReturnType<typeof database>
const recordAiUsage = vi.fn()

const database = (active = 0) => ({
  clientSite: { findUniqueOrThrow: vi.fn().mockResolvedValue(site), update: vi.fn() },
  aiVisibilityPrompt: {
    count: vi.fn().mockResolvedValue(active),
    findMany: vi.fn().mockResolvedValue([{ text: 'Jak vybrat kávovar?' }]),
    createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })),
  },
  searchConsoleMetric: { groupBy: vi.fn().mockResolvedValue([{ query: 'pákový kávovar' }]) },
  article: { findMany: vi.fn().mockResolvedValue([{ id: 'art-1', title: 'Pákové kávovary', excerpt: 'Test' }]) },
  comment: { findMany: vi.fn().mockResolvedValue([]) },
})

beforeEach(() => {
  vi.mocked(generateText).mockReset()
  db = database()
  vi.stubGlobal('prisma', db)
  vi.stubGlobal('aiModel', () => 'test-model')
  vi.stubGlobal('recordAiUsage', recordAiUsage)
})
afterEach(() => vi.unstubAllGlobals())

describe('visibility prompt seeding', () => {
  it('links article prompts, drops already tracked questions and logs usage', async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        prompts: [
          { text: 'Jaký pákový kávovar koupit domů?', ref: 'Q1' },
          { text: 'Jak vybrat kávovar?', ref: 'SITE' },
          { text: 'Vyplatí se pákový kávovar začátečníkovi?', ref: 'A1' },
        ],
      },
      usage: { totalTokens: 42 },
    } as never)

    expect(await seedVisibilityPrompts('site')).toEqual({ created: 2 })
    expect(db.aiVisibilityPrompt.createMany.mock.calls[0]![0].data).toEqual([
      expect.objectContaining({ source: 'SEARCH_CONSOLE', articleId: undefined, language: 'cs' }),
      expect.objectContaining({ source: 'ARTICLE', articleId: 'art-1' }),
    ])
    expect(db.clientSite.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { aiPromptsSeededAt: expect.any(Date) } }),
    )
    expect(recordAiUsage).toHaveBeenCalledWith('site', 42, 'AI_VISIBILITY_PROMPTS_SEEDED', expect.anything())
  })

  it('never calls the model once the tenant is at the cap', async () => {
    db = database(AUTO_PROMPT_LIMIT)
    vi.stubGlobal('prisma', db)
    expect(await seedVisibilityPrompts('site')).toEqual({ created: 0 })
    expect(generateText).not.toHaveBeenCalled()
    expect(db.clientSite.update).toHaveBeenCalled()
  })

  it('asks only for the free slots', async () => {
    db = database(AUTO_PROMPT_LIMIT - 2)
    vi.stubGlobal('prisma', db)
    vi.mocked(generateText).mockResolvedValue({
      output: {
        prompts: [
          { text: 'První otázka o kávovarech?', ref: 'SITE' },
          { text: 'Druhá otázka o kávovarech?', ref: 'SITE' },
          { text: 'Třetí otázka o kávovarech?', ref: 'SITE' },
        ],
      },
      usage: { totalTokens: 1 },
    } as never)
    expect(await seedVisibilityPrompts('site')).toEqual({ created: 2 })
    expect(vi.mocked(generateText).mock.calls[0]![0].prompt).toContain('Write up to 2 distinct questions')
  })
})
