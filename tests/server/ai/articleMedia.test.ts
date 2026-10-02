import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { streamArticle } from '../../../server/utils/ai/article'
import { findStockImage } from '../../../server/utils/images/chain'
import { finalizeArticle } from '../../../server/utils/ai/articleMedia'
import { applyContentSlots, dropAuthoredImages } from '../../../shared/utils/contentSlots'

vi.mock('../../../server/utils/images/chain', () => ({
  findStockImage: vi.fn(),
}))
vi.mock('../../../server/utils/images/steam', () => ({ createSteamImageSearch: () => async () => null }))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
  streamText: vi.fn(() => ({})),
}))

const draft = () => ({
  title: 'The Witcher 4',
  perex: 'Ciri leads the new game.',
  content: '<h2>Ciri</h2>[[IMAGE1]][[IMAGE2]][[IMAGE2]][[IMAGE3]]',
  answer: '',
  keyTakeaways: [],
  faq: [],
  coverImage: { type: 'photo' as const, query: 'Witcher 4 Ciri', broaderQuery: '' },
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
const aiCover = (query = 'abstract game design') => ({ type: 'generate' as const, query, broaderQuery: '' })
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
  vi.stubGlobal('dropAuthoredImages', dropAuthoredImages)
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
        findFirstOrThrow: vi.fn().mockResolvedValue({ language: 'en', plan, features: [{ isActive }] }),
      },
      knowledgeSource: { findFirst: vi.fn().mockResolvedValue(null) },
    })
    vi.stubGlobal('aiModel', () => 'test-model')
    vi.mocked(findStockImage).mockResolvedValue(null)
    const generation = await streamArticle('site', 'Game design', { research: false, allowGeneratedImages: requested })
    const object = { ...draft(), coverImage: aiCover('game design'), images: [] }
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

  it('fills a slot the writer wrapped in its own markup and drops the images it guessed', async () => {
    vi.mocked(findStockImage).mockResolvedValueOnce(null).mockResolvedValueOnce(hit('body')).mockResolvedValue(null)
    const result = await finalizeArticle({
      ...draft(),
      content:
        '<figure><img src="[[IMAGE1]]" alt="Plot" /><figcaption>Plot</figcaption></figure><p>a</p>' +
        '<figure><img src="[[IMAGE2]]" alt="Hills" /><figcaption>Hills</figcaption></figure>' +
        '<img src="https://listing.test/photo.jpg" alt="Listing">',
      images: draft().images.slice(0, 2),
    })
    expect(result.content.match(/<img /g)).toHaveLength(1)
    expect(result.content).toContain('images.test/body')
    expect(result.content).not.toMatch(/alt="(Plot|Hills|Listing)"|listing\.test|Hills<\/figcaption>/)
  })

  it('never generates a cover or body image when AI fallback is disabled', async () => {
    vi.mocked(findStockImage).mockResolvedValue(null)
    const object = {
      ...draft(),
      coverImage: aiCover(),
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
    const object = { ...draft(), coverImage: aiCover(), images: [] }
    const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true })
    expect(vi.mocked(findStockImage).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(generateImage).mock.invocationCallOrder[0]!,
    )
    expect(generateImage).toHaveBeenCalledTimes(1)
    expect(result.articleImageCredit?.kind).toBe('ai')
  })

  it('does not generate when an existing cover was found, even with permission', async () => {
    vi.mocked(findStockImage).mockResolvedValue(hit('existing'))
    const object = { ...draft(), coverImage: aiCover(), images: [] }
    expect((await finalizeArticle(object, 'en', { allowGeneratedImages: true })).articleImageUrl).toBe(
      'https://images.test/existing',
    )
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('falls back from the exact cover subject to its broader subject, labelled as illustrative', async () => {
    vi.mocked(findStockImage).mockResolvedValueOnce(null).mockResolvedValueOnce(hit('mountains'))
    const object = {
      ...draft(),
      coverImage: { type: 'photo' as const, query: 'wooden bungalow Jeseniky', broaderQuery: 'Jeseniky mountains' },
      images: [],
    }
    const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true })
    expect(findStockImage).toHaveBeenLastCalledWith('photo', 'Jeseniky mountains')
    expect(result.articleImageUrl).toBe('https://images.test/mountains')
    expect(result.articleImageCredit?.kind).toBe('illustration')
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('illustrates a photo cover nobody photographed without depicting people or the event', async () => {
    vi.mocked(findStockImage).mockResolvedValue(null)
    vi.mocked(generateImage).mockResolvedValue({ url: 'https://images.test/ai', width: 1200, height: 800 } as never)
    const object = {
      ...draft(),
      coverImage: { type: 'photo' as const, query: 'wooden bungalow Jeseniky', broaderQuery: 'Jeseniky mountains' },
      images: [],
    }
    const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true })
    expect(vi.mocked(generateImage).mock.calls[0]![0]).toMatch(/Jeseniky mountains.*No people/)
    expect(result.articleImageUrl).toBe('https://images.test/ai')
    expect(result.articleImageCredit?.kind).toBe('ai')
  })

  it('uses a labelled subject portrait when a specific event query has no licensed match', async () => {
    vi.mocked(findStockImage).mockResolvedValueOnce(null).mockResolvedValueOnce(hit('babis-portrait'))
    const object = {
      ...draft(),
      coverImage: { type: 'photo' as const, query: 'Andrej Babis Petr Pavel 2026 meeting', broaderQuery: '' },
      images: [],
    }
    const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true })
    expect(findStockImage).toHaveBeenNthCalledWith(1, 'photo', 'Andrej Babis Petr Pavel 2026 meeting')
    expect(findStockImage).toHaveBeenNthCalledWith(2, 'photo', 'Andrej Babis')
    expect(result.articleImageCredit?.kind).toBe('illustration')
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('never synthesizes the people or event of an unavailable documentary cover', async () => {
    vi.mocked(findStockImage).mockResolvedValue(null)
    vi.mocked(generateImage).mockResolvedValue({ url: 'https://images.test/ai', width: 1200, height: 800 } as never)
    const object = {
      ...draft(),
      coverImage: { type: 'photo' as const, query: 'Andrej Babis 2026 meeting', broaderQuery: '' },
      images: [],
    }
    const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true })
    expect(vi.mocked(generateImage).mock.calls[0]![0]).toMatch(
      /No people, faces, logos, text or depiction of a specific real event/,
    )
    expect(result.articleImageCredit?.kind).toBe('ai')
  })
})

it('leaves an unavailable documentary photo empty instead of inventing one', async () => {
  vi.mocked(findStockImage).mockResolvedValue(null)
  const object = { ...draft(), coverImage: null, images: [draft().images[0]!] }
  const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true })
  expect(result.content).not.toContain('<img')
  expect(generateImage).not.toHaveBeenCalled()
})

it('prefers a real photo of a named subject over AI and reports where every image came from', async () => {
  vi.mocked(findStockImage).mockResolvedValueOnce(null).mockResolvedValueOnce(hit('babis')).mockResolvedValue(null)
  vi.mocked(generateImage).mockResolvedValue({
    url: 'https://images.test/generated',
    width: 1200,
    height: 800,
  } as never)
  const onMedia = vi.fn()
  const object = {
    ...draft(),
    content: '<h2>Ciri</h2>[[IMAGE1]][[IMAGE2]]',
    coverImage: { type: 'stock' as const, query: 'Andrej Babis press conference crowd', broaderQuery: '' },
    images: [
      { type: 'generate' as const, query: 'abstract data flow', caption: '' },
      { type: 'photo' as const, query: 'Witcher 4 Ciri', caption: '' },
    ],
  }
  const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true, onMedia })
  expect(findStockImage).toHaveBeenNthCalledWith(2, 'photo', 'Andrej Babis')
  expect(result.articleImageUrl).toBe('https://images.test/babis')
  expect(generateImage).toHaveBeenCalledTimes(1)
  expect(onMedia).toHaveBeenLastCalledWith(
    expect.objectContaining({ stage: 'complete', found: 2, total: 3, cover: 'library', slots: ['ai', null] }),
  )
})
