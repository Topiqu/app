import { generateText } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    vi.mocked(generateText).mockResolvedValue({ output: { depicts: false } } as never)

    await expect(imageDepicts(image, check)).resolves.toEqual({ depicts: false })

    expect(fetchPublicUrl).toHaveBeenCalledWith('https://images.test/thumb.jpg')
    const call = vi.mocked(generateText).mock.calls[0]![0] as any
    expect(call.model).toBe('imageCheck')
    expect(call.providerOptions).toEqual({ anthropic: { thinking: { type: 'disabled' } } })
    const [picture, text] = call.messages[0].content
    expect(picture).toEqual({ type: 'image', image: new Uint8Array([255, 216, 255]), mediaType: 'image/jpeg' })
    expect(text.text).toContain('Article: Dotace na zateplení 2026')
    expect(text.text).toContain('Wanted picture: house facade insulation')
    expect(text.text).toContain('does not have to be that exact one')
  })

  it('requires the subject itself for a photo', async () => {
    fetchPublicUrl.mockResolvedValue(jpeg())
    vi.mocked(generateText).mockResolvedValue({ output: { depicts: true } } as never)
    await expect(imageDepicts({ ...image, previewUrl: undefined }, { ...check, type: 'photo' })).resolves.toEqual({
      depicts: true,
    })
    expect(fetchPublicUrl).toHaveBeenCalledWith('https://images.test/original.jpg')
    expect((vi.mocked(generateText).mock.calls[0]![0] as any).messages[0].content[1].text).toContain(
      'must show this subject itself',
    )
  })

  it('rejects what is not a readable image without asking the model', async () => {
    fetchPublicUrl.mockResolvedValue(new Response('<html>', { headers: { 'content-type': 'text/html' } }))
    await expect(imageDepicts(image, check)).resolves.toMatchObject({ depicts: false, failure: expect.any(String) })
    expect(generateText).not.toHaveBeenCalled()
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
