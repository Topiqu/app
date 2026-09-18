import { generateObject } from 'ai'
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
  coverImage: { type: 'photo' as const, query: 'Witcher 4 Ciri' },
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
  vi.mocked(generateObject).mockReset()
  vi.stubGlobal('prisma', {
    clientSite: { findFirstOrThrow: vi.fn().mockResolvedValue({ tokenRemaining: 10000, language: 'en' }) },
  })
  vi.stubGlobal('currentTokenOperation', () => null)
  vi.stubGlobal('aiModel', () => 'test-model')
  vi.stubGlobal('getServerTranslator', async () => () => 'Review failed')
})
afterEach(() => vi.unstubAllGlobals())

describe('manual editorial review', () => {
  it('fact-checks once, revises a rejected manual draft, and accounts for both calls', async () => {
    const revision = { ...draft, title: 'Ciri leads The Witcher 4' }
    vi.mocked(generateObject)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(response(revision, 20) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })
    expect(await generation.review(draft)).toEqual(revision)
    expect(generation.editorialReview).toMatchObject({
      approved: true,
      revised: true,
      checkedAfterRevision: false,
      resolvedIssues: rejected.issues,
    })
    expect(generateObject).toHaveBeenCalledTimes(2)
    expect(generation.editorialTokens).toBe(30)
    expect(vi.mocked(generateObject).mock.calls[0]![0].prompt).toContain('"polls":[]')
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
