import sharp from 'sharp'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const url = query.url as string

  if (!url) {
    throw createError({ statusCode: 400, message: 'Missing URL' })
  }

  try {
    const response = await fetch(url)
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

    const base64String = buffer.toString('base64')

    return {
      success: true,
      dataUrl: `data:image/png;base64,${base64String}`,
    }
  } catch (error) {
    console.error('OG Proxy error:', error)
    throw createError({ statusCode: 500, message: 'Failed to process image' })
  }
})
