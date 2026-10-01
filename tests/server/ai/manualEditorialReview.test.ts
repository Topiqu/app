import { generateObject, generateText, streamObject } from 'ai'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { streamArticle } from '../../../server/utils/ai/article'

vi.mock('ai', () => ({ generateObject: vi.fn(), generateText: vi.fn(), streamObject: vi.fn(() => ({})) }))

const draft = {
  title: 'The Witcher 4: Ciri',
  perex: 'A supported introduction.',
  content: '<h2>Ciri</h2><p>A draft.</p>',
  answer: '',
  keyTakeaways: [],
  faq: [],
  coverImage: { type: 'photo' as const, query: 'Witcher 4 Ciri', broaderQuery: '' },
  images: [],
  polls: [],
  videos: [],
  tags: [],
  sources: [],
}
const rejected = {
  approved: false,
  issues: [{ code: 'unsupported_claim', note: 'Remove the unsupported claim about returning characters.' }],
}
const approved = { approved: true, issues: [] }
const response = (object: unknown, totalTokens: number) => ({ object, usage: { totalTokens } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(generateObject).mockReset()
  vi.mocked(generateText).mockReset()
  vi.stubGlobal('prisma', {
    clientSite: { findFirstOrThrow: vi.fn().mockResolvedValue({ language: 'en' }) },
    knowledgeSource: { findFirst: vi.fn().mockResolvedValue(null) },
  })
  vi.stubGlobal('aiModel', () => 'test-model')
  vi.stubGlobal('getServerTranslator', async () => () => 'Review failed')
})
afterEach(() => vi.unstubAllGlobals())

describe('manual editorial review', () => {
  it('checks the revision before approving it and accounts for every call', async () => {
    const revision = { ...draft, title: 'Ciri leads The Witcher 4' }
    vi.mocked(generateObject)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(response(revision, 20) as never)
      .mockResolvedValueOnce(response(approved, 5) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })
    expect(await generation.review(draft)).toEqual(revision)
    expect(generation.editorialReview).toMatchObject({
      approved: true,
      revised: true,
      checkedAfterRevision: true,
      resolvedIssues: rejected.issues,
    })
    expect(generateObject).toHaveBeenCalledTimes(3)
    expect(generation.editorialTokens).toBe(35)
    expect(vi.mocked(generateObject).mock.calls[0]![0].prompt).toContain('"polls":[]')
    expect(vi.mocked(generateObject).mock.calls[2]![0].prompt).toContain(revision.title)
  })

  it('does not approve a rewrite that still repeats the absence of confirmation', async () => {
    const emptyAngle = {
      approved: false,
      issues: [
        {
          code: 'missing_specifics',
          note: 'Three sections repeat that no connection is confirmed; compare the documented positions instead.',
        },
      ],
    }
    const revision = { ...draft, content: '<h2>No announcement</h2><p>No connection is confirmed.</p>' }
    vi.mocked(generateObject)
      .mockResolvedValueOnce(response(emptyAngle, 10) as never)
      .mockResolvedValueOnce(response(revision, 20) as never)
      .mockResolvedValueOnce(response(emptyAngle, 5) as never)
    const generation = await streamArticle('site', 'Compare the two positions', {
      research: false,
      format: 'comparison',
      modules: [],
    })

    expect(await generation.review(draft)).toEqual(revision)
    expect(generation.editorialReview).toMatchObject({
      approved: false,
      revised: true,
      checkedAfterRevision: true,
      issues: emptyAngle.issues,
      resolvedIssues: [],
    })
    expect(generateObject).toHaveBeenCalledTimes(3)
    expect(vi.mocked(generateObject).mock.calls[1]![0].prompt).toContain('rebuild the thesis and section progression')
  })

  it('keeps a rewritten draft available without falsely approving it when rechecking fails', async () => {
    const revision = { ...draft, title: 'A concrete comparison' }
    vi.mocked(generateObject)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(response(revision, 20) as never)
      .mockRejectedValueOnce(new Error('review unavailable'))
    vi.stubGlobal('reportCaughtError', vi.fn())
    const generation = await streamArticle('site', 'Compare the two positions', { research: false })

    expect(await generation.review(draft)).toEqual(revision)
    expect(generation.editorialReview).toMatchObject({ approved: false, revised: true, checkedAfterRevision: false })
    expect(generation.editorialReview?.issues[0]?.note).toContain('could not be checked')
    expect(generation.editorialTokens).toBe(30)
  })

  it('reuses verified premises for the final copy desk without repeating web verification', async () => {
    const source = 'https://example.test/positions'
    const correction = 'https://example.test/decision'
    vi.stubGlobal('aiWebSearchTool', () => ({}))
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: `The organizations describe different decision-making policies. ${source}`,
        sources: [{ sourceType: 'url', url: source }],
        usage: { totalTokens: 4 },
      } as never)
      .mockResolvedValueOnce({
        text: `SUPPORTED: The first organization centralizes decisions. ${correction}`,
        sources: [{ sourceType: 'url', url: correction }],
        usage: { totalTokens: 7 },
      } as never)
    const revision = { ...draft, title: 'Two conflicting ways to decide', sources: [correction] }
    vi.mocked(generateObject)
      .mockResolvedValueOnce(
        response(
          {
            approved: false,
            issues: [
              { code: 'missing_specifics', note: 'Replace the repeated caveats with a comparison of who decides.' },
            ],
          },
          10,
        ) as never,
      )
      .mockResolvedValueOnce(response(revision, 20) as never)
      .mockResolvedValueOnce(response(approved, 5) as never)
    const generation = await streamArticle('site', 'Compare decision-making', { format: 'comparison', modules: [] })

    expect(await generation.review({ ...draft, sources: [source] })).toEqual(revision)
    expect(generateText).toHaveBeenCalledTimes(2)
    expect(vi.mocked(generateObject).mock.calls[2]![0].prompt).toContain(correction)
    expect(generation.editorialTokens).toBe(42)
    expect(generation.editorialReview).toMatchObject({ approved: true, revised: true, checkedAfterRevision: true })
  })

  it.each(['news', 'opinion'] as const)('gives the writer and reviewer the same HIGH policy for %s', async (format) => {
    vi.mocked(prisma.clientSite.findFirstOrThrow).mockResolvedValue({
      language: 'en',
      aiControversyLevel: 'HIGH',
    } as never)
    vi.mocked(generateObject).mockResolvedValueOnce(response(approved, 10) as never)
    const generation = await streamArticle('site', 'Explain the contrast', { research: false, format, modules: [] })
    await generation.review(draft)
    const writer = vi.mocked(streamObject).mock.calls.at(-1)![0].instructions as string
    const reviewer = vi.mocked(generateObject).mock.calls[0]![0].instructions as string
    for (const instructions of [writer, reviewer]) {
      expect(instructions).toContain('Use a bold, opinionated voice')
      expect(instructions).toContain('Sources establish the factual premises')
      if (format === 'news')
        expect(instructions).toContain('even HIGH controversy does not turn news into an opinion column')
      else expect(instructions).toContain('opinion can defend a thesis')
    }
    expect(generation.editorialReview?.approved).toBe(true)
  })

  it('returns the reviewed original with a warning when the revision call fails', async () => {
    vi.mocked(generateObject)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockRejectedValueOnce(new Error('revision unavailable'))
    vi.stubGlobal('reportCaughtError', vi.fn())
    const generation = await streamArticle('site', 'Write a report', { research: false })
    expect(await generation.review(draft)).toEqual(draft)
    expect(generation.editorialReview).toMatchObject({ approved: false, revised: false })
    expect(generation.editorialTokens).toBe(10)
  })

  it('does not rewrite an approved draft', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(response(approved, 10) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })
    expect(await generation.review(draft)).toBe(draft)
    expect(generateObject).toHaveBeenCalledTimes(1)
    expect(generation.editorialTokens).toBe(10)
  })
})
