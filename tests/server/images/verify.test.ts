import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/images/publicFetch'), 'fetchPublicUrl', 'readLimitedBody')
}

const { fetchPublicUrl } = vi.hoisted(() => ({ fetchPublicUrl: vi.fn() }))
vi.mock('../../../server/utils/images/publicFetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../server/utils/images/publicFetch')>()),
  fetchPublicUrl,
}))
vi.mock('ai', async (importOriginal) => ({ ...(await importOriginal<typeof import('ai')>()), generateText: vi.fn() }))

const { imageDepicts } = await import('../../../server/utils/images/verify')

const image = {
  url: 'https://images.test/original.jpg',
  previewUrl: 'https://images.test/thumb.jpg',
  credit: { source: 'Openverse' },
}
const check = { title: 'Dotace na zateplení 2026', query: 'house facade insulation', type: 'stock' as const }
const jpeg = () => new Response(new Uint8Array([255, 216, 255]), { headers: { 'content-type': 'image/jpeg' } })

describe('imageDepicts', () => {
  beforeEach(() => vi.stubGlobal('aiModel', (task: string) => task))
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('shows the model the preview with the article and the wanted subject, without thinking', async () => {
    fetchPublicUrl.mockResolvedValue(jpeg())
    vi.mocked(generateText).mockResolvedValue({
      output: { fit: 3, reason: 'Another house.', alt: 'A house.' },
    } as never)

    await expect(imageDepicts(image, check)).resolves.toEqual({
      depicts: false,
      fit: 3,
      reason: 'Another house.',
      alt: 'A house.',
    })

    expect(fetchPublicUrl).toHaveBeenCalledWith('https://images.test/thumb.jpg', 8000, undefined)
    const call = vi.mocked(generateText).mock.calls[0]![0] as any
    expect(call.model).toBe('imageCheck')
    expect(call.providerOptions).toEqual({ anthropic: { thinking: { type: 'disabled' } } })
    const [picture, text] = call.messages[0].content
    expect(picture).toEqual({ type: 'image', image: new Uint8Array([255, 216, 255]), mediaType: 'image/jpeg' })
    expect(text.text).toContain('Article: Dotace na zateplení 2026')
    expect(text.text).toContain('Picture wanted here: house facade insulation')
    expect(text.text).not.toContain('itself is wanted')
  })

  it('requires the subject itself for a photo', async () => {
    fetchPublicUrl.mockResolvedValue(jpeg())
    vi.mocked(generateText).mockResolvedValue({
      output: { fit: 4, reason: 'The summit.', alt: 'The summit.' },
    } as never)
    await expect(imageDepicts({ ...image, previewUrl: undefined }, { ...check, type: 'photo' })).resolves.toEqual({
      depicts: true,
      fit: 4,
      reason: 'The summit.',
      alt: 'The summit.',
    })
    expect(fetchPublicUrl).toHaveBeenCalledWith('https://images.test/original.jpg', 8000, undefined)
    expect((vi.mocked(generateText).mock.calls[0]![0] as any).messages[0].content[1].text).toContain('itself is wanted')
  })

  it('writes the alt text in the language of the article, not of the archive', async () => {
    fetchPublicUrl.mockResolvedValue(jpeg())
    vi.mocked(generateText).mockResolvedValue({
      output: { fit: 5, reason: 'A radiator.', alt: ' Litinový radiátor pod oknem. ' },
    } as never)
    await expect(
      imageDepicts({ ...image, alt: 'Cast iron radiator' }, { ...check, language: 'cs' }),
    ).resolves.toMatchObject({ depicts: true, alt: 'Litinový radiátor pod oknem.' })
    expect((vi.mocked(generateText).mock.calls[0]![0] as any).messages[0].content[1].text).toContain(
      'Write the alt text in Czech',
    )
  })

  it('rejects what is not a readable image without asking the model', async () => {
    fetchPublicUrl.mockResolvedValue(new Response('<html>', { headers: { 'content-type': 'text/html' } }))
    await expect(imageDepicts(image, check)).resolves.toMatchObject({ depicts: false, failure: expect.any(String) })
    expect(generateText).not.toHaveBeenCalled()
  })

  it('checks geographic context and archive metadata rather than treating article language as location', async () => {
    fetchPublicUrl.mockResolvedValue(jpeg())
    vi.mocked(generateText).mockResolvedValue({ output: { fit: 1, reason: 'US.', alt: 'x' } } as never)
    await imageDepicts({ ...image, alt: 'US housing development' }, { ...check, context: 'Czech housing subsidies' })
    const call = vi.mocked(generateText).mock.calls[0]![0] as any
    const text = call.messages[0].content[1].text
    expect(text).toContain('Czech housing subsidies')
    expect(text).toContain('US housing development')
    expect(text).toContain('Do not infer country solely from the article language')
  })

  it('judges the picture wanted in its place, and lets only a good fit through', async () => {
    fetchPublicUrl.mockResolvedValue(jpeg())
    vi.mocked(generateText).mockResolvedValue({ output: { fit: 3, reason: 'An 1861 engraving.', alt: 'x' } } as never)
    const wanted = 'Litinový radiátor ve starém domě.'
    await expect(imageDepicts(image, { ...check, query: 'cast iron radiator', wanted })).resolves.toMatchObject({
      depicts: false,
    })
    const text = (vi.mocked(generateText).mock.calls[0]![0] as any).messages[0].content[1].text
    expect(text).toContain(`Picture wanted here: ${wanted}`)
    expect(text).toContain('Archive search that found it: cast iron radiator')
  })

  it('rejects when the download or the model fails', async () => {
    fetchPublicUrl.mockRejectedValueOnce(new Error('Official media host resolved to a non-public address'))
    await expect(imageDepicts(image, check)).resolves.toEqual({
      depicts: false,
      failure: 'Official media host resolved to a non-public address',
    })
    fetchPublicUrl.mockResolvedValue(jpeg())
    vi.mocked(generateText).mockRejectedValue(new Error('overloaded'))
    await expect(imageDepicts(image, check)).resolves.toEqual({ depicts: false, failure: 'overloaded' })
  })
})

beforeEach(stubImports)
