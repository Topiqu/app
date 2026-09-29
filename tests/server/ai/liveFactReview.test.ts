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

it('requires revision when supported facts only repeat a missing confirmation without developing the topic', async () => {
  vi.mocked(generateText).mockResolvedValue({
    text: `SUPPORTED: The subjects have separate documented positions. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  const issue = {
    code: 'missing_specifics',
    note: 'The lead, table and ending repeat the lack of a connection. Compare the documented positions on shared criteria.',
  }
  vi.mocked(generateObject).mockResolvedValue({
    object: { approved: false, issues: [issue] },
    usage: { totalTokens: 20 },
  } as never)

  const result = await reviewArticle(draft, context)
  expect(result.review).toMatchObject({ approved: false, issues: [issue] })
  expect(buildRevisionPrompt(context.prompt, draft, result.review)).toContain('substantive comparison')
})

it('verifies factual premises without requiring a source to publish the same opinion', async () => {
  vi.mocked(generateText).mockResolvedValue({
    text: `SUPPORTED: The two organizations describe different policies. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  const opinion = {
    ...draft,
    content:
      '<p>These positions conflict: one centralizes the decision while the other leaves it to individuals. If applied together, they would require a compromise over who decides.</p>',
    polls: [],
  }
  const result = await reviewArticle(opinion, { ...context, format: 'opinion' })

  expect(result.review.approved).toBe(true)
  const instructions = vi.mocked(generateText).mock.calls[0]![0].instructions as string
  expect(instructions).toContain('Verify the factual premises of arguments and scenarios')
  expect(instructions).toContain('do not mark these as unsupported events')
  expect(instructions).toContain('Never invent an event, action, quotation')
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

it('keeps advisory NOT VERIFIED verdicts out of the revision', async () => {
  const contradicted = `CONTRADICTED: The trial is unconfirmed. Developers confirmed it. ${url}`
  const advisory = `NOT VERIFIED: The exact release window. ${url}`
  vi.mocked(generateText).mockResolvedValue({
    text: `${contradicted}\n${advisory}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  const result = await reviewArticle(draft, context)
  const prompt = buildRevisionPrompt(context.prompt, draft, result.review, result.verificationBrief)

  expect(result.verificationBrief).toContain('NOT VERIFIED')
  expect(prompt).toContain(contradicted)
  expect(prompt).not.toContain(advisory)
  expect(prompt).toContain('is not a resolution')
})

it('sends a draft padded with caveats back for revision', async () => {
  vi.mocked(generateText).mockResolvedValue({
    text: `SUPPORTED: Ciri is the protagonist. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  const issue = { code: 'hedging', note: 'Delete the sentence saying the story cannot be documented.' }
  vi.mocked(generateObject).mockResolvedValue({
    object: { approved: false, issues: [issue] },
    usage: { totalTokens: 20 },
  } as never)

  expect((await reviewArticle(draft, context)).review).toMatchObject({ approved: false, issues: [issue] })
})

it('after a verified revision, trusts the verification but still blocks invented details', async () => {
  const reasoning = { code: 'unsupported_claim', note: 'Qualify the claim that small firms have fewer crews.' }
  const quote = { code: 'invented_detail', note: 'Remove the blockquote: nobody said this sentence.' }
  vi.mocked(generateObject).mockResolvedValue({
    object: { approved: false, issues: [reasoning, quote] },
    usage: { totalTokens: 20 },
  } as never)

  const result = await reviewArticle(draft, { ...context, verifyFacts: false, factsChecked: true })
  expect(generateText).not.toHaveBeenCalled()
  expect(result.review).toMatchObject({ approved: false, issues: [quote] })
})

it('lets only an editor-requested story skip documentation of its plot', async () => {
  vi.mocked(generateText).mockResolvedValue({
    text: `SUPPORTED: Ciri is the protagonist. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  await reviewArticle(draft, { ...context, format: 'story', illustrative: true })
  await reviewArticle(draft, { ...context, format: 'story' })
  const [manual, cron] = vi.mocked(generateObject).mock.calls.map((call) => call[0].instructions as string)

  expect(manual).toContain('never ask for its documentation')
  expect(cron).toContain('An invented protagonist, scene or event is invented_detail')
  expect(cron).not.toContain('never ask for its documentation')
})
