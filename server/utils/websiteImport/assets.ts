import sharp from 'sharp'
import { createHash } from 'node:crypto'

import { putToCdn } from '../storage'
import { websiteValueHash } from './policy'
import { analyzeImage } from '../imageAnalysis'
import { fetchPublicUrl, readLimitedBody } from '../images/publicFetch'

export const readWebsiteAsset = async (url: string, field: 'logoUrl' | 'faviconUrl') => {
  const response = await fetchPublicUrl(url, 8000)
  const mime = response.headers.get('content-type')?.split(';')[0]?.toLowerCase() ?? ''
  if (!response.ok || !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(mime)) {
    await response.body?.cancel()
    throw new Error('WEBSITE_ASSET_UNAVAILABLE')
  }
  const bytes = await readLimitedBody(response, 2 * 1024 * 1024)
  const image = sharp(bytes, { limitInputPixels: 16_000_000 })
  const metadata = await image.metadata()
  if (
    !metadata.width ||
    !metadata.height ||
    !metadata.format ||
    !['png', 'jpeg', 'webp', 'gif', 'avif'].includes(metadata.format)
  )
    throw new Error('WEBSITE_ASSET_UNAVAILABLE')
  if (field === 'faviconUrl' && (metadata.width !== metadata.height || metadata.width < 32))
    throw new Error('WEBSITE_ASSET_UNAVAILABLE')
  const favicon = field === 'faviconUrl'
  const normalized = await image
    .rotate()
    .resize({ width: favicon ? 192 : 1200, height: favicon ? 192 : 1200, fit: 'inside', withoutEnlargement: true })
    .toFormat(favicon ? 'png' : 'webp')
    .toBuffer()
  if (normalized.length > 2 * 1024 * 1024) throw new Error('WEBSITE_ASSET_UNAVAILABLE')
  return { bytes: normalized, mimeType: favicon ? 'image/png' : 'image/webp' }
}

export const storeWebsiteAsset = async (input: {
  id: string
  clientSiteId: string
  field: 'logoUrl' | 'faviconUrl'
  sourceUrl: string
}) => {
  const asset = await readWebsiteAsset(input.sourceUrl, input.field)
  const moderation = await sharp(asset.bytes)
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .jpeg()
    .toBuffer()
  const tags = await analyzeImage(moderation)
  const digest = createHash('sha256').update(asset.bytes).digest('hex').slice(0, 16)
  const key = `uploads/${input.clientSiteId}/${input.id}-${input.field}-${digest}.${input.field === 'faviconUrl' ? 'png' : 'webp'}`
  return putToCdn(key, asset.bytes, asset.mimeType, {
    'website-import': input.id,
    'source-hash': websiteValueHash(input.sourceUrl),
    'rekognition-tags': tags.join(','),
  })
}
