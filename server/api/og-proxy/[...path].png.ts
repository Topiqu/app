import sharp from 'sharp'

export default defineEventHandler(async (event) => {
  const path = event.context.params?.path || ''
  const imageUrl = decodeURIComponent(path.replace(/\.png$/, ''))

  if (!imageUrl) {
    throw createError({ statusCode: 400 })
  }

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error()

    const arrayBuffer = await response.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    const buffer = await sharp(inputBuffer)
      .png({ quality: 80 })
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()

    setHeaders(event, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })

    return buffer
  } catch {
    throw createError({ statusCode: 500 })
  }
})
