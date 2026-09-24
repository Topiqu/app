import { readFileSync } from 'node:fs'
import { generateObject, generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AI_EMBEDDING_MODELS } from '../../../server/utils/ai/modelRegistry'
import { buildEditorialReviewPrompt, reviewArticle } from '../../../server/utils/ai/articleQuality'

vi.mock('ai', () => ({ generateObject: vi.fn(), generateText: vi.fn() }))

const draft = { title: 'Topiqu vs Jasper', perex: 'A comparison.', content: '<p>Approval takes two hours a week.</p>' }
const knowledgeBrief = '[K1] "Customer research" · updated 2026-08-02 · internal — never cite or link\nApproval takes two hours a week.'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('aiModel', () => 'test-model')
  vi.stubGlobal('aiWebSearchTool', () => ({}))
  vi.mocked(generateObject).mockResolvedValue({ object: { approved: true, issues: [] }, usage: { totalTokens: 5 } } as never)
  vi.mocked(generateText).mockResolvedValue({
    text: 'SUPPORTED Jasper pricing https://jasper.test/pricing',
    sources: [{ sourceType: 'url', url: 'https://jasper.test/pricing' }],
    usage: { totalTokens: 10 },
    finishReason: 'stop',
  } as never)
})
afterEach(() => vi.unstubAllGlobals())

describe('review with first-party knowledge', () => {
  it('gives the live verifier the knowledge and its staleness and conflict rules', async () => {
    await reviewArticle(draft, { prompt: 'Topiqu vs Jasper', researchBrief: null, knowledgeBrief, verifyFacts: true })
    const call = vi.mocked(generateText).mock.calls[0]![0] as { instructions: string; prompt: string }

    expect(JSON.parse(call.prompt).firstPartyKnowledge).toBe(knowledgeBrief)
    expect(call.instructions).toMatch(/entry marked STALE/)
    expect(call.instructions).toMatch(/first-party and web conflict/)
  })

  it('leaves the verifier untouched when no knowledge was retrieved', async () => {
    await reviewArticle(draft, { prompt: 'Topiqu vs Jasper', researchBrief: null, verifyFacts: true })
    const call = vi.mocked(generateText).mock.calls[0]![0] as { instructions: string; prompt: string }

    expect(JSON.parse(call.prompt)).not.toHaveProperty('firstPartyKnowledge')
    expect(call.instructions).not.toMatch(/firstPartyKnowledge/)
  })

  it('shows the copy desk the knowledge it may rely on', () => {
    expect(buildEditorialReviewPrompt(draft, { prompt: 'x', researchBrief: null, knowledgeBrief })).toContain(
      "First-party knowledge (the publisher's own material):",
    )
  })
})

describe('embedding registry', () => {
  it('matches the vector column the migration created', () => {
    const migration = readFileSync('prisma/migrations/20260924150000_knowledge_base/migration.sql', 'utf8')
    expect(migration).toContain(`vector(${AI_EMBEDDING_MODELS.knowledge.dimensions})`)
  })
})
