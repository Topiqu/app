import { generateObject, generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildRevisionPrompt, reviewArticle } from '../../../server/utils/ai/articleQuality'

vi.mock('ai', () => ({ generateObject: vi.fn(), generateText: vi.fn() }))

const draft = {
  title: 'The Witcher 4',
  perex: 'Ciri leads the game.',
  content: 'Developers have not confirmed whether Ciri passed the Trial of Grasses.',
  polls: [{ question: 'Who returns?', options: ['Cahir', 'Bonhart'] }],
}
const context = { prompt: 'Witcher 4 news', researchBrief: 'An incomplete initial brief.', verifyFacts: true }
const url = 'https://www.gamespot.com/articles/the-witcher-4-director-on-ciri-gwent-and-in-game-romance/1100-6528580/'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('aiModel', () => 'test-model')
  vi.stubGlobal('aiWebSearchTool', () => ({}))
  vi.mocked(generateObject).mockResolvedValue({
    object: { approved: true, issues: [] },
    usage: { totalTokens: 20 },
  } as never)
})
afterEach(() => vi.unstubAllGlobals())

describe('independent verification of the written draft', () => {
  it('rejects a truncated verification even when its first claim has a real source', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: `SUPPORTED: Ciri is the protagonist. ${url}`,
      sources: [{ sourceType: 'url', url }],
      usage: { totalTokens: 30 },
      finishReason: 'length',
    } as never)
    expect((await reviewArticle(draft, context)).review.approved).toBe(false)
    expect(generateObject).not.toHaveBeenCalled()
  })
  it('rejects a contradicted claim even if the copy desk approves, and supplies the correction to revision', async () => {
    const finding = `CONTRADICTED: Ciri's trial is unconfirmed. Developers explicitly confirmed it on 2024-12-19; the circumstances were undisclosed. ${url}`
    vi.mocked(generateText).mockResolvedValue({
      text: finding,
      sources: [{ sourceType: 'url', url }],
      usage: { totalTokens: 30 },
    } as never)
    const result = await reviewArticle(draft, context)
    expect(result.review.approved).toBe(false)
    expect(result.review.issues[0]?.note).toContain('explicitly confirmed')
    expect(result.usage.totalTokens).toBe(50)
    expect(buildRevisionPrompt(context.prompt, draft, result.review, result.verificationBrief)).toContain(finding)
    expect(vi.mocked(generateText).mock.calls[0]![0]).toMatchObject({ toolChoice: 'required' })
    expect(vi.mocked(generateText).mock.calls[0]![0].prompt).toContain('Bonhart')
  })

  it('rejects a claim without verification even alongside supported facts', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: `SUPPORTED: Ciri is the protagonist. ${url}\nUNSUPPORTED MATERIAL: Cahir returns in the new game.`,
      sources: [{ sourceType: 'url', url }],
      usage: { totalTokens: 30 },
    } as never)
    expect((await reviewArticle(draft, context)).review.approved).toBe(false)
  })

  it('cannot approve when web verification returns no retrieved evidence', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: `SUPPORTED: all claims. ${url}`,
      sources: [],
      usage: { totalTokens: 30 },
    } as never)
    const result = await reviewArticle(draft, context)
    expect(result.review.approved).toBe(false)
    expect(generateObject).not.toHaveBeenCalled()
    expect(result.usage.totalTokens).toBe(30)
  })
})

it('allows minor unverified qualifications when the copy desk approves', async () => {
  vi.mocked(generateText).mockResolvedValue({
    text: `SUPPORTED: Ciri leads. ${url}\nNOT VERIFIED: The demonstrated town may change. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  expect((await reviewArticle(draft, context)).review.approved).toBe(true)
})

it('does not block publication for stylistic repetition', async () => {
  vi.mocked(generateText).mockResolvedValue({
    text: `SUPPORTED: Ciri leads. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  vi.mocked(generateObject).mockResolvedValue({
    object: {
      approved: false,
      issues: [{ code: 'repetition', note: 'The short recap repeats previously stated facts.' }],
    },
    usage: { totalTokens: 20 },
  } as never)
  expect((await reviewArticle(draft, context)).review.approved).toBe(true)
})

it('keeps factual severity with the live verifier instead of a copy-desk uncertainty veto', async () => {
  vi.mocked(generateText).mockResolvedValue({
    text: `SUPPORTED: Ciri leads. ${url}\nNOT VERIFIED: Exact extent is undisclosed. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  vi.mocked(generateObject).mockResolvedValue({
    object: {
      approved: false,
      issues: [{ code: 'unsupported_claim', note: 'The precise absence of an announcement was not established.' }],
    },
    usage: { totalTokens: 20 },
  } as never)
  expect((await reviewArticle(draft, context)).review.approved).toBe(true)
})
