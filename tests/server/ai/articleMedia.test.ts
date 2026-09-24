import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { findStockImage } from '../../../server/utils/images/chain'
import { applyContentSlots } from '../../../shared/utils/contentSlots'
import { finalizeArticle, streamArticle } from '../../../server/utils/ai/article'

vi.mock('../../../server/utils/images/chain', () => ({
  findStockImage: vi.fn(),
}))
vi.mock('../../../server/utils/images/steam', () => ({ createSteamImageSearch: () => async () => null }))
vi.mock('ai', () => ({ generateObject: vi.fn(), generateText: vi.fn(), streamObject: vi.fn(() => ({})) }))

const draft = () => ({
  title: 'The Witcher 4',
  perex: 'Ciri leads the new game.',
  content: '<h2>Ciri</h2>[[IMAGE1]][[IMAGE2]][[IMAGE2]][[IMAGE3]]',
  answer: '',
  keyTakeaways: [],
  faq: [],
  coverImage: { type: 'photo' as const, query: 'Witcher 4 Ciri' },
  images: [1, 2, 3].map(() => ({
    type: 'photo' as const,
    query: 'Witcher 4 Ciri',
    caption: 'An invented scene the writer has not seen.',
  })),
  polls: [],
  videos: [],
  tags: [],
  sources: [],
})
const hit = (id: string) => ({
  kind: 'photo' as const,
  image: {
    url: `https://images.test/${id}`,
    alt: 'Verified catalogue description',
    credit: { source: 'archive', sourceUrl: `https://archive.test/${id}` },
  },
})

beforeEach(() => {
  vi.mocked(findStockImage).mockReset()
  vi.stubGlobal('getServerTranslator', async () => (key: string) => key)
  vi.stubGlobal('dropBlankLines', (content: string) => content)
  vi.stubGlobal('applyContentSlots', applyContentSlots)
  vi.stubGlobal('generateImage', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('article media finalization', () => {
  it.each([
    { plan: 'BASIC', isActive: true, requested: true },
    { plan: 'PRO', isActive: false, requested: true },
    { plan: 'PRO', isActive: true, requested: false },
  ])('enforces site and request permissions before synthesis: %j', async ({ plan, isActive, requested }) => {
    vi.stubGlobal('prisma', {
      clientSite: {
        findFirstOrThrow: vi
          .fn()
          .mockResolvedValue({ tokenRemaining: 10000, language: 'en', plan, features: [{ isActive }] }),
      },
      knowledgeSource: { findFirst: vi.fn().mockResolvedValue(null) },
    })
    vi.stubGlobal('currentTokenOperation', () => null)
    vi.stubGlobal('aiModel', () => 'test-model')
    vi.mocked(findStockImage).mockResolvedValue(null)
    const generation = await streamArticle('site', 'Game design', { research: false, allowGeneratedImages: requested })
    const object = { ...draft(), coverImage: { type: 'generate' as const, query: 'game design' }, images: [] }
    await generation.finalize(object, { allowGeneratedImages: true })
    expect(generateImage).not.toHaveBeenCalled()
  })
  it('emits each asset once and never repeats the cover in the body', async () => {
    vi.mocked(findStockImage)
      .mockResolvedValueOnce(hit('cover'))
      .mockResolvedValueOnce(hit('cover'))
      .mockResolvedValueOnce(hit('body'))
      .mockResolvedValueOnce(hit('body'))
    const onImage = vi.fn()
    const result = await finalizeArticle(draft(), 'en', { onImage })
    expect(result.articleImageUrl).toBe('https://images.test/cover')
    expect(result.content.match(/<img /g)).toHaveLength(1)
    expect(result.content).not.toContain('images.test/cover')
    expect(result.content).not.toContain('invented scene')
    expect(result.content).not.toContain('[[IMAGE')
    expect(onImage).toHaveBeenCalledTimes(1)
  })

  it('leaves documentary misses empty instead of synthesizing or duplicating a body image', async () => {
    vi.mocked(findStockImage).mockResolvedValueOnce(null).mockResolvedValueOnce(hit('body')).mockResolvedValue(null)
    const result = await finalizeArticle(draft())
    expect(result.articleImageUrl).toBe('')
    expect(result.content.match(/<img /g)).toHaveLength(1)
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('never generates a cover or body image when AI fallback is disabled', async () => {
    vi.mocked(findStockImage).mockResolvedValue(null)
    const object = {
      ...draft(),
      coverImage: { type: 'generate' as const, query: 'abstract game design' },
      images: [{ type: 'generate' as const, query: 'abstract game design', caption: '' }],
    }
    const result = await finalizeArticle(object, 'en', { allowGeneratedImages: false })
    expect(generateImage).not.toHaveBeenCalled()
    expect(result.articleImageUrl).toBe('')
    expect(result.content).not.toContain('<img')
    expect(findStockImage).toHaveBeenCalledTimes(2)
  })

  it('uses AI only after existing image searches miss and permission is enabled', async () => {
    vi.mocked(findStockImage).mockResolvedValue(null)
    vi.mocked(generateImage).mockResolvedValue({
      url: 'https://images.test/generated',
      width: 1200,
      height: 800,
    } as never)
    const object = { ...draft(), coverImage: { type: 'generate' as const, query: 'abstract game design' }, images: [] }
    const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true })
    expect(vi.mocked(findStockImage).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(generateImage).mock.invocationCallOrder[0]!,
    )
    expect(generateImage).toHaveBeenCalledTimes(1)
    expect(result.articleImageCredit?.kind).toBe('ai')
  })

  it('does not generate when an existing cover was found, even with permission', async () => {
    vi.mocked(findStockImage).mockResolvedValue(hit('existing'))
    const object = { ...draft(), coverImage: { type: 'generate' as const, query: 'abstract game design' }, images: [] }
    expect((await finalizeArticle(object, 'en', { allowGeneratedImages: true })).articleImageUrl).toBe(
      'https://images.test/existing',
    )
    expect(generateImage).not.toHaveBeenCalled()
  })
})

it('labels enabled photo fallback as AI and discards the documentary caption', async () => {
  vi.mocked(findStockImage).mockResolvedValue(null)
  vi.mocked(generateImage).mockResolvedValue({ url: 'https://images.test/ai', width: 1200, height: 800 } as never)
  const object = { ...draft(), coverImage: null, images: [draft().images[0]!] }
  const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true })
  expect(result.content).toContain('data-ai-disclosure')
  expect(result.content).not.toContain('invented scene')
})
