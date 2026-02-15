import sharp from 'sharp'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const imageUrl = query.url as string

  if (!imageUrl) {
    throw createError({ statusCode: 400, message: 'Missing URL parameter' })
  }

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)

    const arrayBuffer = await response.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    const pngBuffer = await sharp(inputBuffer)
      .toFormat('png')
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer()

    setHeaders(event, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })

    return pngBuffer
  } catch (error) {
    console.error('OG Proxy error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to convert image to PNG',
    })
  }
})
