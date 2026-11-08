import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchPublicUrl, readLimitedBody } = vi.hoisted(() => ({ fetchPublicUrl: vi.fn(), readLimitedBody: vi.fn() }))
vi.mock('../../../server/utils/images/publicFetch', () => ({ fetchPublicUrl, readLimitedBody }))

const { copyProductImage, copyProductImages, refreshProductImages } =
  await import('../../../server/utils/knowledge/productImage')

const row = {
  id: 'p1',
  clientSiteId: 'site',
  imageUrl: 'https://shop.test/ryc.jpg',
  cdnImageUrl: null as string | null,
  cdnImageSource: null as string | null,
}
const updateMany = vi.fn()
const findMany = vi.fn()
const queryRaw = vi.fn()
const putToCdn = vi.fn()
const deleteFromCdn = vi.fn()

const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#0a0' } })
  .png()
  .toBuffer()

beforeEach(() => {
  vi.clearAllMocks()
  updateMany.mockResolvedValue({ count: 1 })
  putToCdn.mockImplementation(async (key: string) => `https://cdn.test/${key}`)
  deleteFromCdn.mockResolvedValue(undefined)
  fetchPublicUrl.mockResolvedValue(new Response('x', { headers: { 'content-type': 'image/png' } }))
  readLimitedBody.mockResolvedValue(new Uint8Array(png))
  vi.stubGlobal('prisma', { knowledgeProduct: { updateMany, findMany }, $queryRaw: queryRaw })
  vi.stubGlobal('putToCdn', putToCdn)
  vi.stubGlobal('deleteFromCdn', deleteFromCdn)
})
afterEach(() => vi.unstubAllGlobals())

describe('copyProductImage', () => {
  it('stores a 480 px WebP under the site prefix, conditional on the source still being current', async () => {
    const url = await copyProductImage(row)

    expect(url).toMatch(/^https:\/\/cdn\.test\/knowledge\/products\/site\/p1-[0-9a-f]{16}\.webp$/)
    const [, body, type, , options] = putToCdn.mock.calls[0]!
    expect(type).toBe('image/webp')
    expect(options).toEqual({ cacheControl: 'public, max-age=31536000, immutable' })
    expect(await sharp(body).metadata()).toMatchObject({ format: 'webp', width: 480, height: 320 })
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', imageUrl: row.imageUrl },
      data: { cdnImageUrl: url, cdnImageSource: row.imageUrl },
    })
  })

  it('copies a source once', async () => {
    const copied = { ...row, cdnImageUrl: 'https://cdn.test/a.webp', cdnImageSource: row.imageUrl }
    expect(await copyProductImage(copied)).toBe('https://cdn.test/a.webp')
    expect(fetchPublicUrl).not.toHaveBeenCalled()
  })

  it('remembers a failed copy instead of refetching it on every insert', async () => {
    fetchPublicUrl.mockResolvedValue(new Response('<html>', { headers: { 'content-type': 'text/html' } }))
    expect(await copyProductImage(row)).toBeNull()
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { cdnImageUrl: null, cdnImageSource: row.imageUrl } }),
    )

    vi.clearAllMocks()
    const failed = { ...row, cdnImageSource: row.imageUrl }
    expect(await copyProductImage(failed)).toBeNull()
    expect(fetchPublicUrl).not.toHaveBeenCalled()
  })

  it('replaces a copy of an old image and deletes it', async () => {
    const old = 'https://cdn.test/knowledge/products/site/p1-old.webp'
    await copyProductImage({ ...row, cdnImageUrl: old, cdnImageSource: 'https://shop.test/old.jpg' })
    expect(deleteFromCdn).toHaveBeenCalledWith('knowledge/products/site/p1-old.webp', 'knowledge/products/site/')
  })
})

describe('copyProductImages', () => {
  it('loads only products of the given site', async () => {
    findMany.mockResolvedValue([])
    await copyProductImages('site', ['p1', 'foreign'])
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientSiteId: 'site', id: { in: ['p1', 'foreign'] } } }),
    )
  })
})

describe('refreshProductImages', () => {
  it('retries failed copies and follows a changed image', async () => {
    queryRaw.mockResolvedValue([{ ...row, cdnImageSource: row.imageUrl }])
    await refreshProductImages('source')
    expect(fetchPublicUrl).toHaveBeenCalledWith(row.imageUrl, 8000)
    expect(putToCdn).toHaveBeenCalledOnce()
  })
})
