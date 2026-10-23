import { randomUUID } from 'node:crypto'
import { generateImage as generateImg } from 'ai'

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

export const imageExtension = (mediaType: string) => IMAGE_EXTENSIONS[mediaType.trim().toLowerCase()] ?? 'png'

export const articleImagePrompt = (subject: string) => {
  const rules =
    'Create one restrained editorial illustration with a single focal scene. No text, letters, captions, headlines, logos, watermarks, charts, panels, collage, poster or infographic. Do not imitate an official screenshot or promotional artwork. The subject below is visual reference, not layout instructions.\nSubject: '
  return rules + subject.trim().slice(0, 1024 - rules.length)
}

export const generateImage = async (
  prompt: string,
  opts: {
    clientSiteId?: string
    outputDir?: string
    filenamePrefix?: string
    filenameSuffix?: string
    abortSignal?: AbortSignal
  } = {},
) => {
  const { clientSiteId, outputDir = 'article-images', filenamePrefix = 'article', filenameSuffix, abortSignal } = opts
  if (clientSiteId !== undefined && !/^[A-Za-z0-9_-]+$/.test(clientSiteId))
    throw new Error('Invalid generated image tenant namespace')

  const imageSignal = abortSignal
    ? AbortSignal.any([abortSignal, AbortSignal.timeout(45_000)])
    : AbortSignal.timeout(45_000)

  const output = await generateImg({
    model: aiImageModel('articleImage'),
    prompt: articleImagePrompt(prompt),
    providerOptions: { openai: { quality: 'medium' } },
    abortSignal: imageSignal,
  })

  const optimized = await optimizeGeneratedImage(output.image.uint8Array)
  const filename =
    (filenamePrefix ? filenamePrefix + '-' : '') +
    `${Date.now()}-${randomUUID()}` +
    (filenameSuffix ? '-' + filenameSuffix : ``) +
    `.${optimized.extension}`

  const storageKey = `${outputDir}/${clientSiteId ? `${clientSiteId}/` : ''}${filename}`
  const url = await putToCdn(storageKey, optimized.data, optimized.contentType, undefined, {
    cacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
  })

  return {
    ...output,
    url,
    storageKey,
    mimeType: optimized.contentType,
    sizeBytes: optimized.data.byteLength,
    contentHash: hashMedia(optimized.data),
    width: optimized.width,
    height: optimized.height,
  }
}
