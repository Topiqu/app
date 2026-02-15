import sharp from 'sharp'

export default defineEventHandler(async (event) => {
  const { url } = getQuery(event)

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing URL' })
  }

  try {
    const response = await $fetch(url, { responseType: 'arrayBuffer' })
    const buffer = Buffer.from(response as ArrayBuffer)

    const pngBuffer = await sharp(buffer)
      .resize({ width: 200, fit: 'inside', withoutEnlargement: true })
      .png({ quality: 80 })
      .toBuffer()

    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

    return pngBuffer
  } catch {
    throw createError({ statusCode: 500, message: 'Conversion failed' })
  }
})
