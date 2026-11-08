import sharp from 'sharp'
import { createHash } from 'node:crypto'

import { IMMUTABLE_IMAGE_CACHE_CONTROL } from '../images/optimize'
import { fetchPublicUrl, readLimitedBody } from '../images/publicFetch'

const MAX_SOURCE_BYTES = 5 * 1024 * 1024
export const PRODUCT_IMAGE_WIDTH = 480
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
// Bounds the work one feed sync spends on cards whose image changed.
const REFRESH_LIMIT = 50

type ProductImageRow = {
  id: string
  clientSiteId: string
  imageUrl: string | null
  cdnImageUrl: string | null
  cdnImageSource: string | null
}

const IMAGE_SELECT = { id: true, clientSiteId: true, imageUrl: true, cdnImageUrl: true, cdnImageSource: true } as const

const keyPrefix = (clientSiteId: string) => `knowledge/products/${clientSiteId}/`

const readProductImage = async (url: string) => {
  const response = await fetchPublicUrl(url, 8000)
  const mime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!response.ok || !IMAGE_TYPES.has(mime)) {
    await response.body?.cancel()
    throw new Error('Product image unavailable')
  }
  const bytes = await readLimitedBody(response, MAX_SOURCE_BYTES)
  const data = await sharp(bytes, { animated: false, limitInputPixels: 16_000_000 })
    .rotate()
    .resize({ width: PRODUCT_IMAGE_WIDTH, height: PRODUCT_IMAGE_WIDTH, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
  return new Uint8Array(data)
}

/**
 * Copies the feed image once per source URL. A failed copy is remembered too (`cdnImageUrl` null),
 * so the card renders without a picture instead of refetching on every insert; a sync retries it.
 */
export const copyProductImage = async (product: ProductImageRow, { retry = false } = {}) => {
  if (product.cdnImageSource === product.imageUrl && (product.cdnImageUrl || !retry || !product.imageUrl))
    return product.cdnImageUrl
  let url: string | null = null
  if (product.imageUrl) {
    try {
      const digest = createHash('sha256').update(product.imageUrl).digest('hex').slice(0, 16)
      url = await putToCdn(
        `${keyPrefix(product.clientSiteId)}${product.id}-${digest}.webp`,
        await readProductImage(product.imageUrl),
        'image/webp',
        undefined,
        { cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL },
      )
    } catch {
      url = null
    }
  }
  // Conditional on the source still being current: a sync may have replaced it meanwhile.
  const saved = await prisma.knowledgeProduct.updateMany({
    where: { id: product.id, imageUrl: product.imageUrl },
    data: { cdnImageUrl: url, cdnImageSource: product.imageUrl },
  })
  if (saved.count && product.cdnImageUrl && product.cdnImageUrl !== url)
    await deleteFromCdn(new URL(product.cdnImageUrl).pathname.slice(1), keyPrefix(product.clientSiteId)).catch(() => {})
  return url
}

/** `clientSiteId` is the isolation: ids come from article bodies an author could have edited. */
export const copyProductImages = async (clientSiteId: string, ids: readonly string[]) => {
  if (!ids.length) return
  const products = await prisma.knowledgeProduct.findMany({
    where: { clientSiteId, id: { in: [...ids] } },
    select: IMAGE_SELECT,
  })
  await Promise.all(products.map((product) => copyProductImage(product)))
}

/** Only images already used in a card are refreshed; the rest are copied when a card first needs one. */
export const refreshProductImages = async (sourceId: string) => {
  const products = await prisma.$queryRaw<ProductImageRow[]>`
    SELECT "id", "clientSiteId", "imageUrl", "cdnImageUrl", "cdnImageSource" FROM "KnowledgeProduct"
    WHERE "sourceId" = ${sourceId} AND "cdnImageSource" IS NOT NULL
      AND ("cdnImageSource" IS DISTINCT FROM "imageUrl" OR "cdnImageUrl" IS NULL)
    LIMIT ${REFRESH_LIMIT}`
  for (const product of products) await copyProductImage(product, { retry: true })
}
