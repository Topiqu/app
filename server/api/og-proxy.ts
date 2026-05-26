import sharp from 'sharp'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const url = query.url as string

  if (!url) {
    throw createError({ statusCode: 400, message: 'Missing URL' })
  }

  const safeUrl = assertAllowedUrl(url)

  try {
    const response = await fetch(safeUrl, { redirect: 'error', signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)

    const arrayBuffer = await response.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    const buffer = await sharp(inputBuffer)
      .png({ quality: 85 })
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer()

    return {
      base64: `data:image/png;base64,${buffer.toString('base64')}`,
    }
  } catch (error) {
    throw createError({ statusCode: 500, message: `Failed to process image ${error}` })
  }
})
