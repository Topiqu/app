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
  it('reviews all modules, revises a rejected draft, and accounts for every completed call', async () => {
    const revision = { ...draft, title: 'Ciri leads The Witcher 4' }
    vi.mocked(generateObject)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(response(revision, 20) as never)
      .mockResolvedValueOnce(response(approved, 30) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })
    expect(await generation.review(draft)).toEqual(revision)
    expect(generation.editorialTokens).toBe(60)
    expect(vi.mocked(generateObject).mock.calls[0]![0].prompt).toContain('"polls":[]')
  })

  it('rejects the result when revision still fails review', async () => {
    vi.mocked(generateObject)
      .mockResolvedValueOnce(response(rejected, 10) as never)
      .mockResolvedValueOnce(response(draft, 20) as never)
      .mockResolvedValueOnce(response(rejected, 30) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })
    await expect(generation.review(draft)).rejects.toThrow('Review failed')
    expect(generation.editorialTokens).toBe(60)
  })

  it('does not rewrite an approved draft', async () => {
    vi.mocked(generateObject).mockResolvedValueOnce(response(approved, 10) as never)
    const generation = await streamArticle('site', 'Write a report', { research: false })
    expect(await generation.review(draft)).toBe(draft)
    expect(generateObject).toHaveBeenCalledTimes(1)
    expect(generation.editorialTokens).toBe(10)
  })
})
