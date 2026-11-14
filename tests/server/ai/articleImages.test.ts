import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

const stubImports = () => stubNitroImports(import('../../../server/utils/ai/reasoning'), 'aiReasoning')
await stubImports()

const { repickArticleImages } = await import('../../../server/utils/ai/articleImages')

vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  generateText: vi.fn(),
}))

const figure = (name: string) =>
  `<figure class="article-image"><img src="https://cdn.test/${name}.webp" alt="Venkovní jednotka u domu."><figcaption>AI</figcaption></figure>`
const video =
  '<figure class="article-video"><div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe></div></figure>'
const article = {
  id: 'article-1',
  title: 'Kam umístit tepelné čerpadlo',
  excerpt: 'Vzdálenost od sousedů rozhoduje.',
  content: `<h2>Hluk</h2>${figure('old-1')}<p>Text.</p>${video}${figure('old-2')}`,
  language: 'cs' as const,
  published: true,
}
const planned = (query: string) => ({ type: 'stock' as const, query, broaderQuery: 'air source heat pump' })

const finalizeArticle = vi.fn()
beforeEach(async () => {
  await stubImports()
  vi.stubGlobal('aiModel', (task: string) => task)
  vi.stubGlobal('imageRules', () => 'IMAGE RULES')
  vi.stubGlobal('finalizeArticle', finalizeArticle)
  vi.stubGlobal('prisma', {
    article: {
      findMany: async () => [{ title: 'Jak odhadnout hluk', coverMedia: { name: 'outdoor unit by a wall' } }],
    },
  })
  vi.mocked(generateText).mockResolvedValue({
    output: {
      coverSubject: 'Zahrada mezi dvěma domy',
      coverImage: planned('heat pump garden'),
      images: [
        { ...planned('sound level meter'), caption: 'Měření hluku zvukoměrem.' },
        { ...planned('hydraulic module'), caption: 'Vnitřní modul v technické místnosti.' },
      ],
    },
    usage: { totalTokens: 900 },
  } as never)
  finalizeArticle.mockImplementation(async (_object, _language, { onImage }) => {
    onImage({ slot: 1, html: '<figure class="article-image"><img src="https://photos.test/meter.jpg"></figure>' })
    return { articleImageUrl: 'https://photos.test/cover.jpg', articleCoverMediaId: 'cover-media' }
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(generateText).mockReset()
  finalizeArticle.mockReset()
})

describe('picking the pictures of a saved article again', () => {
  it('replaces the pictures it found, keeps the rest and never touches the text or the video', async () => {
    const result = await repickArticleImages('site', article)
    expect(result).toEqual({
      content: `<h2>Hluk</h2><figure class="article-image"><img src="https://photos.test/meter.jpg"></figure><p>Text.</p>${video}${figure('old-2')}`,
      imageUrl: 'https://photos.test/cover.jpg',
      coverMediaId: 'cover-media',
      tokens: 900,
    })
  })

  it('plans one picture per slot and a named cover subject unlike the other covers, rights-clear when published', async () => {
    await repickArticleImages('site', article)
    const call = vi.mocked(generateText).mock.calls[0]![0]
    expect(call.instructions).toContain('IMAGE RULES')
    expect(call.instructions).toContain("Name the cover's main subject in coverSubject first")
    expect(JSON.parse(String(call.prompt))).toMatchObject({
      text: expect.stringContaining('[[IMAGE1]]'),
      slots: [
        { slot: 1, currentPicture: 'Venkovní jednotka u domu.' },
        { slot: 2, currentPicture: 'Venkovní jednotka u domu.' },
      ],
      otherCovers: [{ article: 'Jak odhadnout hluk', cover: 'outdoor unit by a wall' }],
    })
    const [object, language, options] = finalizeArticle.mock.calls[0]!
    expect(object.content).toBe(`<h2>Hluk</h2>[[IMAGE1]]<p>Text.</p>${video}[[IMAGE2]]`)
    expect(object.images.map((image: { query: string }) => image.query)).toEqual([
      'sound level meter',
      'hydraulic module',
    ])
    expect(language).toBe('cs')
    expect(options).toMatchObject({
      clientSiteId: 'site',
      allowGeneratedImages: true,
      requireClearRights: true,
      coverSubject: 'Zahrada mezi dvěma domy',
    })
  })

  it('keeps the cover when nothing new was found', async () => {
    finalizeArticle.mockResolvedValue({ articleImageUrl: '', articleCoverMediaId: null })
    expect((await repickArticleImages('site', article)).imageUrl).toBeNull()
  })
})
