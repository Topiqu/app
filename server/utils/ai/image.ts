import { join } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { experimental_generateImage as generateImg } from 'ai'

export const generateImage = async (
  prompt: string,
  opts: {
    outputDir?: string
    filenamePrefix?: string
  } = {},
) => {
  const { outputDir = 'article-images', filenamePrefix = 'article' } = opts

  const { image } = await generateImg({
    model: xai.image('grok-2-image'),
    prompt: prompt.trim().slice(0, 1024),
    maxImagesPerCall: 1,
    n: 1,
  })

  const filename = `${filenamePrefix}-${Date.now()}.webp`
  const uploadDir = join(process.cwd(), `public/${outputDir}`)
  await mkdir(uploadDir, { recursive: true })
  const filePath = join(uploadDir, filename)
  await writeFile(filePath, image.uint8Array)
  const url = `/${outputDir}/${filename}`

  return url
}
