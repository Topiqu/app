import sharp from 'sharp'

export default defineEventHandler(async (event) => {
  const path = event.context.params?.url || ''
  const imageUrl = decodeURIComponent(path.replace(/\.png$/, ''))

  if (!imageUrl) {
    throw createError({ statusCode: 400, message: 'Missing URL' })
  }

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`)

    const arrayBuffer = await response.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    const buffer = await sharp(inputBuffer)
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

    return buffer
  } catch (error) {
    console.error('OG Proxy error:', error)
    throw createError({ statusCode: 500, message: 'Failed to process image' })
  }
})
