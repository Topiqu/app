import sharp from 'sharp'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const imageUrl = query.url as string

  if (!imageUrl) {
    throw createError({ statusCode: 400, message: 'Missing URL' })
  }

  try {
    const response = await fetch(imageUrl)

    if (!response.ok) {
      throw createError({ statusCode: response.status, message: 'Failed to fetch image' })
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const pngBuffer = await sharp(buffer).toFormat('png').toBuffer()

    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

    return pngBuffer
  } catch (error) {
    console.error('OG Proxy Error:', error)
    throw createError({ statusCode: 500, message: 'Image processing failed' })
  }
})
