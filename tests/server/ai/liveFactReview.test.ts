import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
  await stubNitroImports(
    import('../../../server/utils/ai/editorialPolicy'),
    'AUTHORIAL_REASONING',
    'ILLUSTRATIVE_STORY',
  )
  await stubNitroImports(
    import('../../../server/utils/ai/researchEvidence'),
    'extractResearchUrls',
    'researchEvidence',
    'retrievedResearchSources',
  )
}

await stubImports()

const { buildRevisionPrompt, recheckRevision, reviewArticle } = await import('../../../server/utils/ai/articleQuality')

const { generateStructuredText, generatePlainText } = vi.hoisted(() => ({
  generateStructuredText: vi.fn<(typeof import('ai'))['generateText']>(),
  generatePlainText: vi.fn<(typeof import('ai'))['generateText']>(),
}))

vi.mock('ai', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('ai')>()
  return {
    ...sdk,
    generateText: (options: Parameters<typeof sdk.generateText>[0]) =>
      options.output ? generateStructuredText(options) : generatePlainText(options),
  }
})

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
  vi.mocked(generateStructuredText).mockResolvedValue({
    output: { approved: true, issues: [] },
    usage: { totalTokens: 20 },
  } as never)
})
afterEach(() => vi.unstubAllGlobals())

describe('independent verification of the written draft', () => {
  it('rejects a truncated verification even when its first claim has a real source', async () => {
    vi.mocked(generatePlainText).mockResolvedValue({
      text: `SUPPORTED: Ciri is the protagonist. ${url}`,
      sources: [{ sourceType: 'url', url }],
      usage: { totalTokens: 30 },
      finishReason: 'length',
    } as never)
    expect((await reviewArticle(draft, context)).review.approved).toBe(false)
    expect(generateStructuredText).not.toHaveBeenCalled()
    // One retry: an incomplete check holds the article, and it is usually transient.
    expect(generatePlainText).toHaveBeenCalledTimes(2)
  })

  it('approves after a retried verification completes', async () => {
    vi.mocked(generatePlainText)
      .mockResolvedValueOnce({ text: '', sources: [], usage: { totalTokens: 30 }, finishReason: 'length' } as never)
      .mockResolvedValueOnce({
        text: `SUPPORTED: Ciri is the protagonist. ${url}`,
        sources: [{ sourceType: 'url', url }],
        usage: { totalTokens: 30 },
      } as never)
    const result = await reviewArticle(draft, context)
    expect(result.review.approved).toBe(true)
    expect(result.usage.totalTokens).toBe(80)
  })

  it('holds the article when the verification times out twice, instead of failing the review', async () => {
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.mocked(generatePlainText).mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    const result = await reviewArticle(draft, context)
    expect(result.review).toMatchObject({ approved: false, issues: [{ key: 'verificationIncomplete' }] })
    expect(generatePlainText).toHaveBeenCalledTimes(2)
    expect(vi.mocked(generatePlainText).mock.calls[0]![0].abortSignal).toBeInstanceOf(AbortSignal)
  })

  it('retries a timed-out verification and keeps a completed retry', async () => {
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.mocked(generatePlainText)
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      .mockResolvedValueOnce({
        text: `SUPPORTED: Ciri is the protagonist. ${url}`,
        sources: [{ sourceType: 'url', url }],
        usage: { totalTokens: 30 },
      } as never)
    const result = await reviewArticle(draft, context)
    expect(result.review.approved).toBe(true)
    expect(result.usage.totalTokens).toBe(50)
  })

  it('stops instead of retrying once the author cancels', async () => {
    const abort = new AbortController()
    abort.abort()
    vi.mocked(generatePlainText).mockRejectedValue(new DOMException('aborted', 'AbortError'))
    await expect(reviewArticle(draft, { ...context, abortSignal: abort.signal })).rejects.toThrow('aborted')
    expect(generatePlainText).toHaveBeenCalledTimes(1)
  })

  it('keeps our listed product figure and records the manufacturer value only in the audit', async () => {
    const manual = 'https://example.test/olga-manual.pdf'
    const differs = `LISTING DIFFERS: Hopper 17 kg. The manual states 17.5 kg. ${manual}`
    vi.mocked(generatePlainText).mockResolvedValue({
      text: `SUPPORTED: Ciri is the protagonist. ${url}\n${differs}`,
      sources: [
        { sourceType: 'url', url },
        { sourceType: 'url', url: manual },
      ],
      usage: { totalTokens: 30 },
    } as never)
    const result = await reviewArticle(draft, { ...context, knowledgeBrief: '[K1] "OLGA 501 L" · Hopper 17 kg' })

    expect(result.review.approved).toBe(true)
    expect(result.verdicts).toContain(differs)
    expect(result.verificationBrief).not.toContain('LISTING DIFFERS')
    const desk = vi.mocked(generateStructuredText).mock.calls[0]![0]
    expect(desk.prompt).not.toContain('17.5 kg')
    expect(desk.instructions).toContain('never ask to replace or add a figure of our products')
    expect(vi.mocked(generatePlainText).mock.calls[0]![0].instructions).toContain('report LISTING DIFFERS')
  })

  it('rejects a contradicted claim even if the copy desk approves, and supplies the correction to revision', async () => {
    const finding = `CONTRADICTED: Ciri's trial is unconfirmed. Developers explicitly confirmed it on 2024-12-19; the circumstances were undisclosed. ${url}`
    vi.mocked(generatePlainText).mockResolvedValue({
      text: finding,
      sources: [{ sourceType: 'url', url }],
      usage: { totalTokens: 30 },
    } as never)
    const result = await reviewArticle(draft, context)
    expect(result.review.approved).toBe(false)
    expect(result.review.issues[0]?.note).toContain('explicitly confirmed')
    expect(result.usage.totalTokens).toBe(50)
    expect(buildRevisionPrompt(context.prompt, draft, result.review, result.verificationBrief)).toContain(finding)
    expect(vi.mocked(generatePlainText).mock.calls[0]![0]).toMatchObject({ toolChoice: 'required' })
    expect(vi.mocked(generatePlainText).mock.calls[0]![0].prompt).toContain('Bonhart')
  })

  it('rejects a claim without verification even alongside supported facts', async () => {
    vi.mocked(generatePlainText).mockResolvedValue({
      text: `SUPPORTED: Ciri is the protagonist. ${url}\nUNSUPPORTED MATERIAL: Cahir returns in the new game.`,
      sources: [{ sourceType: 'url', url }],
      usage: { totalTokens: 30 },
    } as never)
    expect((await reviewArticle(draft, context)).review.approved).toBe(false)
  })

  it('cannot approve when web verification returns no retrieved evidence', async () => {
    vi.mocked(generatePlainText).mockResolvedValue({
      text: `SUPPORTED: all claims. ${url}`,
      sources: [],
      usage: { totalTokens: 30 },
    } as never)
    const result = await reviewArticle(draft, context)
    expect(result.review.approved).toBe(false)
    expect(generateStructuredText).not.toHaveBeenCalled()
    expect(result.usage.totalTokens).toBe(60)
  })
})

it('allows minor unverified qualifications when the copy desk approves', async () => {
  vi.mocked(generatePlainText).mockResolvedValue({
    text: `SUPPORTED: Ciri leads. ${url}\nNOT VERIFIED: The demonstrated town may change. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  expect((await reviewArticle(draft, context)).review.approved).toBe(true)
})

it('does not block publication for stylistic repetition', async () => {
  vi.mocked(generatePlainText).mockResolvedValue({
    text: `SUPPORTED: Ciri leads. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  vi.mocked(generateStructuredText).mockResolvedValue({
    output: {
      approved: false,
      issues: [{ code: 'repetition', note: 'The short recap repeats previously stated facts.' }],
    },
    usage: { totalTokens: 20 },
  } as never)
  expect((await reviewArticle(draft, context)).review.approved).toBe(true)
})

it('requires revision when supported facts only repeat a missing confirmation without developing the topic', async () => {
  vi.mocked(generatePlainText).mockResolvedValue({
    text: `SUPPORTED: The subjects have separate documented positions. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  const issue = {
    code: 'missing_specifics',
    note: 'The lead, table and ending repeat the lack of a connection. Compare the documented positions on shared criteria.',
    blocking: true,
  }
  vi.mocked(generateStructuredText).mockResolvedValue({
    output: { approved: false, issues: [issue] },
    usage: { totalTokens: 20 },
  } as never)

  const result = await reviewArticle(draft, context)
  expect(result.review).toMatchObject({ approved: false, issues: [issue] })
  expect(buildRevisionPrompt(context.prompt, draft, result.review)).toContain('substantive comparison')
})

it('verifies factual premises without requiring a source to publish the same opinion', async () => {
  vi.mocked(generatePlainText).mockResolvedValue({
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
  const instructions = vi.mocked(generatePlainText).mock.calls[0]![0].instructions as string
  expect(instructions).toContain('Verify the factual premises of arguments and scenarios')
  expect(instructions).toContain('do not mark these as unsupported events')
  expect(instructions).toContain('Never invent an event, action, quotation')
})

it('keeps factual severity with the live verifier instead of a copy-desk uncertainty veto', async () => {
  vi.mocked(generatePlainText).mockResolvedValue({
    text: `SUPPORTED: Ciri leads. ${url}\nNOT VERIFIED: Exact extent is undisclosed. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  vi.mocked(generateStructuredText).mockResolvedValue({
    output: {
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
  vi.mocked(generatePlainText).mockResolvedValue({
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

it('sends a draft padded with caveats back for revision without holding it', async () => {
  vi.mocked(generatePlainText).mockResolvedValue({
    text: `SUPPORTED: Ciri is the protagonist. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  const issue = { code: 'hedging', note: 'Delete the sentence saying the story cannot be documented.', blocking: true }
  vi.mocked(generateStructuredText).mockResolvedValue({
    output: { issues: [issue] },
    usage: { totalTokens: 20 },
  } as never)

  expect((await reviewArticle(draft, context)).review).toMatchObject({
    approved: true,
    issues: [{ ...issue, blocking: false }],
  })
})

it('after a verified revision, trusts the verification but still blocks invented details', async () => {
  const reasoning = { code: 'unsupported_claim', note: 'Qualify the claim that small firms have fewer crews.' }
  const quote = { code: 'invented_detail', note: 'Remove the blockquote: nobody said this sentence.', blocking: true }
  vi.mocked(generateStructuredText).mockResolvedValue({
    output: { approved: false, issues: [reasoning, quote] },
    usage: { totalTokens: 20 },
  } as never)

  const result = await reviewArticle(draft, { ...context, verifyFacts: false, factsChecked: true })
  expect(generatePlainText).not.toHaveBeenCalled()
  expect(result.review).toMatchObject({ approved: false, issues: [quote] })
})

it.each([false, true])('keeps assignment mismatches blocking with factsChecked=%s', async (factsChecked) => {
  const issue = {
    code: 'assignment_mismatch',
    note: 'The title turns the requested opinion into a civility lesson. Restore the assigned stance.',
    blocking: true,
  }
  vi.mocked(generateStructuredText).mockResolvedValue({
    output: { approved: false, issues: [issue] },
    usage: { totalTokens: 20 },
  } as never)

  const result = await reviewArticle(draft, { ...context, verifyFacts: false, factsChecked })

  expect(result.review).toMatchObject({ approved: false, issues: [issue] })
  expect(generatePlainText).not.toHaveBeenCalled()
})

it('lets only an editor-requested story skip documentation of its plot', async () => {
  vi.mocked(generatePlainText).mockResolvedValue({
    text: `SUPPORTED: Ciri is the protagonist. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  await reviewArticle(draft, { ...context, format: 'story', illustrative: true })
  await reviewArticle(draft, { ...context, format: 'story' })
  const [manual, cron] = vi.mocked(generateStructuredText).mock.calls.map((call) => call[0].instructions as string)

  expect(manual).toContain('Never ask for its documentation')
  expect(cron).toContain('An invented protagonist, scene or event is invented_detail')
  expect(cron).not.toContain('Never ask for its documentation')
})

describe('checking a revision', () => {
  const issues = [
    { code: 'unsupported_claim', note: 'Correct the fine amount.', key: 'correctClaim' as const, blocking: true },
    { code: 'hedging', note: 'Delete the caveat.', blocking: false },
    {
      code: 'unsupported_claim',
      note: 'Verification did not finish.',
      key: 'verificationIncomplete' as const,
      blocking: true,
    },
    { code: 'broken_structure', note: 'Add the takeaways.', key: 'module.takeaways' as const, blocking: true },
  ]
  const recheck = (output: unknown) =>
    vi.mocked(generateStructuredText).mockResolvedValue({ output, usage: { totalTokens: 5 } } as never)

  it('asks only about the fixable findings and re-runs structure checks in code', async () => {
    recheck({
      findings: [
        { id: 1, resolved: true },
        { id: 2, resolved: false },
      ],
      introduced: [],
    })
    const revised = { ...draft, keyTakeaways: ['One', 'Two'] }
    const result = await recheckRevision(revised, draft, issues, { ...context, modules: ['takeaways'] })

    const prompt = JSON.parse(vi.mocked(generateStructuredText).mock.calls[0]![0].prompt as string)
    expect(prompt.findings.map((finding: { note: string }) => finding.note)).toEqual([
      'Correct the fine amount.',
      'Delete the caveat.',
    ])
    expect(generatePlainText).not.toHaveBeenCalled()
    expect(result.resolvedIssues.map((issue) => issue.note)).toEqual(['Correct the fine amount.'])
    // A revision cannot finish a verification, so that finding stays and holds the article.
    expect(result.review.approved).toBe(false)
    expect(result.review.issues.map((issue) => issue.key ?? issue.code)).toEqual(['verificationIncomplete', 'hedging'])
  })

  it('approves once the blocking findings are fixed, keeping open edits as tips', async () => {
    recheck({
      findings: [
        { id: 1, resolved: true },
        { id: 2, resolved: false },
      ],
      introduced: [],
    })
    const result = await recheckRevision(draft, draft, issues.slice(0, 2), context)
    expect(result.review).toMatchObject({ approved: true, issues: [{ code: 'hedging', blocking: false }] })
  })

  it('treats a finding the checker skipped as unresolved', async () => {
    recheck({ findings: [], introduced: [] })
    const result = await recheckRevision(draft, draft, issues.slice(0, 1), context)
    expect(result.review.approved).toBe(false)
  })

  it('reports why each finding stays open, for the generation audit', async () => {
    recheck({
      findings: [
        { id: 1, resolved: false, reason: 'The fine is still stated as 5 million.' },
        { id: 2, resolved: true, reason: '' },
      ],
      introduced: [{ note: 'Remove the new "30 days"; no source.' }],
    })
    const result = await recheckRevision(draft, draft, issues.slice(0, 2), context)
    expect(result.unresolved).toEqual([{ code: 'unsupported_claim', reason: 'The fine is still stated as 5 million.' }])
    expect(result.introduced).toEqual([
      { code: 'invented_detail', note: 'Remove the new "30 days"; no source.', blocking: true },
    ])
  })

  it('accepts a narrowed or removed claim even when its note asked for more research', async () => {
    recheck({ findings: [{ id: 1, resolved: true, reason: '' }], introduced: [] })
    await recheckRevision(draft, draft, issues.slice(0, 1), context)
    const { instructions } = vi.mocked(generateStructuredText).mock.calls[0]![0]
    expect(instructions).toContain('even when its note also asked to verify, research or add specifics')
    expect(instructions).toContain('is not a quotation')
  })
})

it('asks the fact-check and the copy desk to narrow or delete, never to research', async () => {
  vi.mocked(generatePlainText).mockResolvedValue({
    text: `SUPPORTED: Ciri is the protagonist. ${url}`,
    sources: [{ sourceType: 'url', url }],
    usage: { totalTokens: 30 },
  } as never)
  await reviewArticle(draft, context)
  const verifier = vi.mocked(generatePlainText).mock.calls[0]![0].instructions as string
  const copyDesk = vi.mocked(generateStructuredText).mock.calls[0]![0].instructions as string
  expect(verifier).toContain('never ask the writer to verify, research or add specifics')
  expect(copyDesk).toContain('never ask the reviser to verify, research or add specifics')
  expect(copyDesk).toContain('are not a quotation and never invented_detail')
})

beforeEach(stubImports)
