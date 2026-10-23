import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { analyzeImage } from '~~/server/utils/imageAnalysis'
import { IMAGE_MAX_UPLOAD_BYTES } from '~~/shared/utils/uploadLimits'
import { canReuseUpload, recordUploadModeration } from '~~/server/utils/uploadModeration'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const files = await readMultipartFormData(event)

  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const file = files.find((part) => Boolean(part.filename))
  if (!file?.type?.startsWith('image/')) {
    throw createError({ statusCode: 400, message: t('common.upload.notImage')! })
  }
  if (file.data.length > IMAGE_MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 413,
      message: t('common.upload.tooLarge', {
        actual: `${(file.data.length / 1e6).toFixed(1)} MB`,
        limit: `${IMAGE_MAX_UPLOAD_BYTES / 1e6} MB`,
      })!,
    })
  }
  const uploadType = files.find((part) => part.name === 'type')?.data.toString() || 'article-image'
  if (!['article-image', 'client-logo', 'client-favicon', 'user-avatar', 'emoji'].includes(uploadType))
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  if (uploadType === 'user-avatar' || uploadType === 'emoji') {
    // Account avatars and emojis have their own authenticated, normalized upload routes.
    if (user.role !== 'superadmin') throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  } else {
    await requireTenantScope(event, uploadType === 'article-image' ? 'ARTICLE_WRITE' : 'TENANT_SETTINGS')
  }
  if (!(await consumeRateLimit(`upload:${user.id}`, 30, 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  const contentHash = hashMedia(file.data)
  const db = uploadType === 'article-image' && user.clientSiteId ? await getEnhancedPrisma(user) : null
  const existing = db
    ? await db.mediaAsset.findFirst({
        where: { clientSiteId: user.clientSiteId, contentHash, purgedAt: null, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    : null
  if (existing && canReuseUpload(existing, user.clientSiteId!, contentHash, useRuntimeConfig().public.cdnUrl)) {
    return {
      success: true,
      url: existing.url,
      optimizedUrl: existing.deliveryUrl || existing.url,
      filename: existing.originalFilename || file.filename,
      tags: existing.machineTags,
      mediaAsset: existing,
      reused: true,
    }
  }
  const metadata = await sharp(file.data, { limitInputPixels: 40_000_000 })
    .metadata()
    .catch(() => null)
  if (!metadata?.format || !['png', 'jpeg', 'webp', 'gif'].includes(metadata.format))
    throw createError({ statusCode: 400, message: t('common.upload.unreadable')! })
  if (uploadType === 'client-favicon') {
    const reason = await validateFaviconUpload(file.data, file.type || '')
    // The client validates the same rules, so a rejection here is worth a readable reason rather than a bare status.
    if (reason) {
      const message = {
        type: t('common.upload.formatNotAllowed', { actual: (file.type || '').replace('image/', '').toUpperCase() }),
        bytes: t('common.upload.tooLarge', {
          actual: `${Math.round(file.data.length / 1e3)} kB`,
          limit: `${FAVICON_MAX_BYTES / 1e3} kB`,
        }),
        unreadable: t('common.upload.unreadable'),
        square: t('common.upload.faviconSquare'),
        dimensions: t('common.upload.faviconDimensions', { min: FAVICON_MIN_SIZE, max: FAVICON_MAX_SIZE }),
      }[reason]
      throw createError({ statusCode: reason === 'bytes' ? 413 : 400, message: message || 'Invalid favicon' })
    }
  }

  const favicon = uploadType === 'client-favicon'
  const normalized = await sharp(file.data, { limitInputPixels: 40_000_000, animated: !favicon })
    .rotate()
    .toFormat(favicon ? 'png' : 'webp')
    .toBuffer()
    .catch(() => null)
  if (!normalized) throw createError({ statusCode: 400, message: t('common.upload.unreadable')! })
  if (normalized.length > IMAGE_MAX_UPLOAD_BYTES)
    throw createError({ statusCode: 413, message: t('common.errors.invalidRequest')! })
  const moderationImage = await sharp(file.data, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()
  const analysis = await analyzeImage(moderationImage)
  const { tags } = analysis
  const detectedTagsString = tags.join(',')

  if (uploadType === 'article-image' && user.clientSiteId) {
    if (existing) {
      let mediaAsset = await registerMediaAsset({
        clientSiteId: user.clientSiteId,
        createdById: user.id,
        url: existing.url,
        deliveryUrl: existing.deliveryUrl,
        contentHash,
        name: file.filename?.replace(/\.[^/.]+$/, '') ?? null,
        originalFilename: file.filename,
        mimeType: existing.mimeType,
        sizeBytes: existing.sizeBytes,
        machineTags: tags,
      })
      mediaAsset = await recordUploadModeration(mediaAsset, user.clientSiteId, contentHash, analysis)
      return {
        success: true,
        url: mediaAsset.url,
        optimizedUrl: mediaAsset.deliveryUrl || mediaAsset.url,
        filename: mediaAsset.originalFilename || file.filename,
        tags: mediaAsset.machineTags,
        mediaAsset,
        reused: true,
      }
    }
  }

  const filename = `${user.clientSiteId || user.id}/${randomUUID()}.${favicon ? 'png' : 'webp'}`
  const storageKey = `uploads/${filename}`
  const contentType = favicon ? 'image/png' : 'image/webp'

  try {
    const url = await putToCdn(storageKey, normalized, contentType, {
      'rekognition-tags': detectedTagsString,
      'original-name': file.filename ? encodeURIComponent(file.filename) : 'unknown',
    })

    let mediaAsset
    if (uploadType === 'article-image' && user.clientSiteId) {
      const xmp = metadata?.xmpAsString ?? ''
      const copyright =
        metadata?.comments?.find((item) => /copyright|rights/i.test(item.keyword))?.text ??
        xmp.match(/<(?:dc:rights|photoshop:Copyright)[^>]*>(?:<[^>]+>)*([^<]+)/i)?.[1]
      const author =
        metadata?.comments?.find((item) => /author|artist|creator/i.test(item.keyword))?.text ??
        xmp.match(/<(?:dc:creator|photoshop:Credit)[^>]*>(?:<[^>]+>)*([^<]+)/i)?.[1]
      mediaAsset = await registerMediaAsset({
        clientSiteId: user.clientSiteId,
        createdById: user.id,
        url,
        deliveryUrl: url,
        storageKey,
        name: file.filename?.replace(/\.[^/.]+$/, '') ?? null,
        originalFilename: file.filename,
        mimeType: contentType,
        sizeBytes: normalized.length,
        contentHash,
        width: metadata?.autoOrient?.width ?? metadata?.width,
        height: metadata?.autoOrient?.height ?? metadata?.height,
        machineTags: tags,
        metadataSignals: {
          author: author?.trim() || undefined,
          copyright: copyright?.trim() || undefined,
          hasExif: Boolean(metadata?.exif),
          hasIptc: Boolean(metadata?.iptc),
          hasXmp: Boolean(metadata?.xmp),
        },
      })
      mediaAsset = await recordUploadModeration(mediaAsset, user.clientSiteId, contentHash, analysis)
      if (mediaAsset.storageKey !== storageKey && mediaAsset.url !== url && mediaAsset.deliveryUrl !== url) {
        // A concurrent identical upload may already own the canonical media row.
        await deleteFromCdn(storageKey, `uploads/${user.clientSiteId}/`).catch(async () => {
          await reportCaughtError('Superseded upload cleanup failed', new Error('UPLOAD_CLEANUP_FAILED'), {
            clientSiteId: user.clientSiteId,
          }).catch(() => {})
        })
      }
    }

    const reused = Boolean(mediaAsset && mediaAsset.url !== url)
    return {
      success: true,
      url: mediaAsset?.url || url,
      optimizedUrl: mediaAsset?.deliveryUrl || mediaAsset?.url || url,
      filename: reused ? mediaAsset?.originalFilename || file.filename : filename,
      tags: mediaAsset?.machineTags || tags,
      mediaAsset,
      ...(reused ? { reused: true } : {}),
    }
  } catch {
    await reportCaughtError('Upload failed', new Error('UPLOAD_FAILED'), {
      clientSiteId: user.clientSiteId,
    }).catch(() => {})
    throw createError({ statusCode: 500, statusMessage: 'Upload failed' })
  }
})
