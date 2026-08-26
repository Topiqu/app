import { randomUUID } from 'node:crypto'
import { analyzeImage } from '~~/server/utils/imageAnalysis'

const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

const safeExt = (name?: string) => {
  const ext = (name?.split('.').pop() || '').toLowerCase()
  return ALLOWED_EXT.includes(ext) ? ext : 'webp'
}

const sanitizeFilename = (raw: string) => {
  const base = raw.split(/[/\\]/).pop() || ''
  const stem = base
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 80)
  return `${stem || `content-${Date.now()}`}.${safeExt(base)}`
}

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const config = useRuntimeConfig()
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const files = await readMultipartFormData(event)

  if (!files || files.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
  }

  const file = files.find((part) => Boolean(part.filename))
  if (!file?.type?.startsWith('image/')) {
    throw createError({ statusCode: 400, message: t('common.upload.notImage')! })
  }
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 413,
      message: t('common.upload.tooLarge', {
        actual: `${(file.data.length / 1e6).toFixed(1)} MB`,
        limit: `${MAX_UPLOAD_BYTES / 1e6} MB`,
      })!,
    })
  }
  const uploadType = files.find((part) => part.name === 'type')?.data.toString()
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

  const tags = await analyzeImage(file.data)
  const detectedTagsString = tags.join(',')

  const customFilename = files.find((part) => part.name === 'customFilename')?.data.toString()
  const filename = customFilename
    ? sanitizeFilename(customFilename)
    : `content-${Date.now()}-${randomUUID().slice(0, 8)}.${safeExt(file.filename)}`
  const optimizedFilename = filename.replace(/\.[^/.]+$/, '.webp')

  try {
    const url = await putToCdn(`uploads/${filename}`, file.data, file.type, {
      'rekognition-tags': detectedTagsString,
      'original-name': file.filename ? encodeURIComponent(file.filename) : 'unknown',
    })

    return {
      success: true,
      url,
      optimizedUrl: `${config.public.cdnUrl}/optimized/${optimizedFilename}`,
      filename,
      tags: detectedTagsString.split(',').filter(Boolean),
    }
  } catch (error) {
    console.error('S3 Upload Error:', error)
    throw createError({ statusCode: 500, statusMessage: 'Upload failed' })
  }
})
