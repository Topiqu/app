import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { streamArticle } from '../../../server/utils/ai/article'
import { findStockImage } from '../../../server/utils/images/chain'
import { finalizeArticle, stockOrigin } from '../../../server/utils/ai/articleMedia'
import { applyContentSlots, dropAuthoredImages } from '../../../shared/utils/contentSlots'
import { createArticleGenerationAudit } from '../../../server/utils/articleGenerationAudit'

vi.mock('../../../server/utils/images/chain', () => ({
  findStockImage: vi.fn(),
}))
const { steamSearch } = vi.hoisted(() => ({
  steamSearch: vi.fn<(query: string, accept: (image: any) => boolean) => Promise<any>>(async () => null),
}))
vi.mock('../../../server/utils/images/steam', () => ({ createSteamImageSearch: () => steamSearch }))
const { imageDepicts } = vi.hoisted(() => ({ imageDepicts: vi.fn(async () => ({ depicts: true })) }))
vi.mock('../../../server/utils/images/verify', () => ({ imageDepicts }))
vi.mock('../../../server/utils/images/appStore', () => ({ createAppStoreImageSearch: () => async () => null }))
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
  imageDepicts.mockReset().mockResolvedValue({ depicts: true })
  steamSearch.mockReset()
  vi.stubGlobal('getServerTranslator', async () => (key: string) => key)
  vi.stubGlobal('dropBlankLines', (content: string) => content)
  vi.stubGlobal('applyContentSlots', applyContentSlots)
  vi.stubGlobal('dropAuthoredImages', dropAuthoredImages)
  vi.stubGlobal('generateImage', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('article media finalization', () => {
  it('audits a failed AI cover and still returns the usable article', async () => {
    const log = vi.fn()
    vi.stubGlobal('logAction', log)
    vi.stubGlobal('reportCaughtError', vi.fn())
    vi.mocked(generateImage).mockRejectedValue(new Error('Image provider unavailable'))
    vi.mocked(findStockImage).mockResolvedValue(null)
    const audit = createArticleGenerationAudit({ attemptId: 'attempt-1', mode: 'manual', clientSiteId: 'site' })
    const result = await finalizeArticle({ ...draft(), coverImage: aiCover(), images: [] }, 'en', {
      allowGeneratedImages: true,
      audit,
    })
    expect(result.title).toBe('The Witcher 4')
    expect(result.articleImageUrl).toBe('')
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ARTICLE_GENERATION_STEP_FAILED',
        metadata: expect.objectContaining({
          stage: 'image_generation',
          slot: 'cover',
          attemptId: 'attempt-1',
          error: 'Image provider unavailable',
        }),
      }),
    )
  })
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

  it('describes a generated body image with its instruction, never a searched one', async () => {
    vi.mocked(findStockImage)
      .mockResolvedValueOnce(hit('cover'))
      .mockResolvedValueOnce(hit('body'))
      .mockResolvedValue(null)
    vi.mocked(generateImage).mockResolvedValue({ url: 'https://images.test/ai', width: 1200, height: 800 } as never)
    const object = {
      ...draft(),
      content: '<p>a</p>[[IMAGE1]][[IMAGE2]]',
      images: [
        { type: 'photo' as const, query: 'Witcher 4 Ciri', caption: 'An invented scene the writer has not seen.' },
        { type: 'generate' as const, query: 'construction site inspection', caption: 'Inspector checking rebar' },
      ],
    }
    const result = await finalizeArticle(object, 'en', { allowGeneratedImages: true })
    expect(result.content).toContain('alt="Inspector checking rebar"')
    expect(result.content).toContain('<figcaption><span data-ai-disclosure>articles.image.ai</span></figcaption>')
    expect(result.content).not.toContain('invented scene')
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
    expect(findStockImage).toHaveBeenLastCalledWith('photo', 'Jeseniky mountains', undefined, expect.any(Function))
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
    expect(findStockImage).toHaveBeenNthCalledWith(
      1,
      'photo',
      'Andrej Babis Petr Pavel 2026 meeting',
      undefined,
      expect.any(Function),
    )
    expect(findStockImage).toHaveBeenNthCalledWith(2, 'photo', 'Andrej Babis', undefined, expect.any(Function))
    expect(result.articleImageCredit?.kind).toBe('illustration')
    expect(generateImage).not.toHaveBeenCalled()
  })

  describe('vision check of library images', () => {
    const insulation = {
      ...draft(),
      title: 'Dotace na zateplení 2026',
      coverImage: { type: 'stock' as const, query: 'house facade insulation', broaderQuery: '' },
      images: [],
    }
    /** Offers the candidates in order, each through the caller's `accept`, like a provider. */
    const offering = (ids: string[]) =>
      vi.mocked(findStockImage).mockImplementation(async (_intent, _query, _chains, accept) => {
        for (const id of ids) if (!accept || (await accept(hit(id).image))) return hit(id)
        return null
      })

    it('looks at each library candidate and moves past one that shows something else', async () => {
      offering(['grand-canyon-ceremony', 'facade'])
      imageDepicts.mockResolvedValueOnce({ depicts: false }).mockResolvedValueOnce({ depicts: true })

      const result = await finalizeArticle(insulation, 'en')

      expect(result.articleImageUrl).toBe('https://images.test/facade')
      expect(imageDepicts).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://images.test/grand-canyon-ceremony' }),
        { title: 'Dotace na zateplení 2026', query: 'house facade insulation', type: 'stock' },
        undefined,
      )
    })

    it('looks at no more than three candidates per search and leaves the slot to the fallback', async () => {
      offering(['a', 'b', 'c', 'd', 'e'])
      imageDepicts.mockResolvedValue({ depicts: false })

      const result = await finalizeArticle(insulation, 'en')

      expect(imageDepicts).toHaveBeenCalledTimes(3)
      expect(result.articleImageUrl).toBe('')
    })

    it('records each look in the generation audit', async () => {
      const log = vi.fn()
      vi.stubGlobal('logAction', log)
      offering(['facade'])
      imageDepicts.mockResolvedValue({ depicts: true })
      const audit = createArticleGenerationAudit({ attemptId: 'attempt-1', mode: 'manual', clientSiteId: 'site' })

      await finalizeArticle(insulation, 'en', { audit })

      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ stage: 'image_check', depicts: true }),
        }),
      )
    })
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
  expect(findStockImage).toHaveBeenNthCalledWith(2, 'photo', 'Andrej Babis', undefined, expect.any(Function))
  expect(result.articleImageUrl).toBe('https://images.test/babis')
  expect(generateImage).toHaveBeenCalledTimes(1)
  expect(onMedia).toHaveBeenLastCalledWith(
    expect.objectContaining({ stage: 'complete', found: 2, total: 3, cover: 'library', slots: ['ai', null] }),
  )
})

describe('auto-published media rights', () => {
  let n = 0
  const register = vi.fn(async (input: Record<string, any>) => ({
    id: `asset-${input.url}`,
    url: input.url,
    deliveryUrl: input.deliveryUrl,
    origin: input.origin,
    sourceUrl: input.sourceUrl ?? null,
    author: input.author ?? null,
    license: input.license ?? null,
    attribution: input.attribution ?? null,
    attributionRequired: input.attributionRequired ?? false,
    rightsConfirmedAt: null,
    metadataSignals: null,
  }))
  const object = () => ({
    ...draft(),
    content: '<h2>Ciri</h2>[[IMAGE1]][[IMAGE2]]',
    images: [
      { type: 'photo' as const, query: 'Witcher 4 Ciri', caption: '' },
      { type: 'generate' as const, query: 'abstract quest map', caption: '' },
    ],
  })
  // Unlicensed stock registers as EXTERNAL, which needs a person to confirm permission.
  const unclear = () => hit(`stock-${++n}`)
  const free = () => {
    const found = hit(`free-${++n}`)
    return { ...found, image: { ...found.image, credit: { ...found.image.credit, license: 'CC0 1.0' } } }
  }
  /** Each search offers an unclear candidate first, then `fallback` when the caller filters. */
  const library = (fallback: (() => ReturnType<typeof hit>) | null) =>
    vi.mocked(findStockImage).mockImplementation(async (_intent, _query, _chains, accept) => {
      const first = unclear()
      if (!accept || (await accept(first.image))) return first
      const next = fallback?.()
      return next && (await accept(next.image)) ? next : null
    })
  const auto = { clientSiteId: 'site', allowGeneratedImages: true, requireClearRights: true }

  beforeEach(() => {
    n = 0
    register.mockClear()
    vi.stubGlobal('registerMediaAsset', register)
    vi.mocked(generateImage).mockImplementation(
      async () => ({ url: `https://images.test/ai-${++n}`, width: 1200, height: 800 }) as never,
    )
  })

  it('takes the next real image with clear rights before any AI', async () => {
    library(free)
    const result = await finalizeArticle(object(), 'en', auto)
    expect(result.articleImageUrl).toContain('images.test/free-')
    expect(result.content.match(/<img /g)).toHaveLength(2)
    expect(result.content).not.toContain('images.test/stock-')
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('falls back to AI only when no real image is clear, and never for a photo slot', async () => {
    library(null)
    const result = await finalizeArticle(object(), 'en', auto)
    expect(result.articleImageCredit?.kind).toBe('ai')
    expect(result.content.match(/<img /g)).toHaveLength(1)
    expect(result.content).toContain('images.test/ai-')
  })

  it('keeps an unclear real cover for review when no illustration is available', async () => {
    library(null)
    const result = await finalizeArticle(object(), 'en', { clientSiteId: 'site', requireClearRights: true })
    expect(result.articleImageUrl).toContain('images.test/stock-')
    expect(result.content).not.toContain('<img')
  })

  it('keeps the first found images when a person reviews the article', async () => {
    library(free)
    const result = await finalizeArticle(object(), 'en', { clientSiteId: 'site', allowGeneratedImages: true })
    expect(result.articleImageUrl).toContain('images.test/stock-')
    expect(result.content.match(/images\.test\/free-/g)).toBeNull()
    expect(generateImage).not.toHaveBeenCalled()
  })

  it.each([
    ['public domain', { license: 'Public Domain Mark 1.0' }],
    ['CC0 without an author', { license: 'CC0 1.0' }],
    ['credited CC BY', { license: 'CC BY-SA 4.0', author: 'Jan Novák' }],
  ])('uses %s stock without confirmation', async (_, credit) => {
    vi.mocked(findStockImage).mockImplementation(async () => {
      const found = hit(`free-${++n}`)
      return { ...found, image: { ...found.image, credit: { ...found.image.credit, ...credit } } }
    })
    const result = await finalizeArticle(object(), 'en', auto)
    expect(result.content.match(/<img /g)).toHaveLength(2)
    expect(generateImage).not.toHaveBeenCalled()
  })

  const steam = () =>
    steamSearch.mockImplementation(async (_query, accept) => {
      const url = `https://shared.steamstatic.com/ss_${++n}.jpg`
      const image = {
        url,
        alt: 'The Witcher 4',
        credit: { source: 'The Witcher 4 — CD Projekt (Steam)', sourceUrl: url },
      }
      return accept(image) ? image : null
    })

  it('files a re-hosted store image as publisher media by its original address', async () => {
    library(null)
    steamSearch.mockImplementation(async (_query, accept) => {
      const url = `https://cdn.topiqu.test/article-images/official-${++n}.jpg`
      const image = {
        url,
        alt: 'The Witcher 4',
        credit: { source: 'Official media', sourceUrl: 'https://cdn1.epicgames.com/offer/witcher/key-art.jpg' },
      }
      return accept(image) ? image : null
    })
    const result = await finalizeArticle(object(), 'en', auto)
    expect(result.articleImageUrl).toContain('official-')
    expect(register.mock.calls[0]?.[0].origin).toBe('PUBLISHER')
  })

  it('uses credited Steam screenshots on autopilot and files them as publisher media', async () => {
    library(null)
    steam()
    const result = await finalizeArticle(object(), 'en', auto)
    expect(result.articleImageUrl).toContain('steamstatic.com')
    expect(result.content.match(/<img /g)).toHaveLength(2)
    expect(register.mock.calls.every(([input]) => input.origin === 'PUBLISHER')).toBe(true)
    expect(generateImage).not.toHaveBeenCalled()
  })

  it.each([
    ['Public Domain Mark 1.0', 'PUBLIC_DOMAIN'],
    ['PD-US', 'PUBLIC_DOMAIN'],
    ['CC0 1.0', 'PUBLIC_DOMAIN'],
    ['CC BY-SA 4.0', 'CREATIVE_COMMONS'],
    ['CC BY-NC 2.0', 'EXTERNAL'],
    ['CC BY-NC-SA 4.0', 'EXTERNAL'],
    ['GFDL', 'EXTERNAL'],
    [undefined, 'EXTERNAL'],
  ])('classifies %s as %s', (license, origin) => {
    expect(stockOrigin(license)).toBe(origin)
  })
})
