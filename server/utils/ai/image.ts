import { generateImage as generateImg } from 'ai'

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

export const imageExtension = (mediaType: string) => IMAGE_EXTENSIONS[mediaType.trim().toLowerCase()] ?? 'png'

export const generateImage = async (
  prompt: string,
  opts: {
    outputDir?: string
    filenamePrefix?: string
    filenameSuffix?: string
  } = {},
) => {
  const { outputDir = 'article-images', filenamePrefix = 'article', filenameSuffix } = opts

  const output = await generateImg({
    model: aiImageModel('articleImage'),
    prompt: prompt.trim().slice(0, 1024),
    providerOptions: { openai: { quality: 'medium' } },
  })

  const filename =
    (filenamePrefix ? filenamePrefix + '-' : '') +
    `${Date.now()}` +
    (filenameSuffix ? '-' + filenameSuffix : ``) +
    `.${imageExtension(output.image.mediaType)}`

  const url = await putToCdn(`${outputDir}/${filename}`, output.image.uint8Array, output.image.mediaType)

  return { ...output, url }
}
