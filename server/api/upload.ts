import sharp from 'sharp'
import { join } from 'path'
import { Filter } from 'content-checker'
import { mkdir, writeFile } from 'fs/promises'
const { openModeratorApiKey } = useRuntimeConfig()

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)
  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.name === 'file')
  const type = form?.find((f) => f.name === 'type')?.data.toString() || 'article-image'

  if (
    !file ||
    !file.type?.startsWith('image/') ||
    !['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)
  ) {
    throw createError({ statusCode: 400, message: 'Podporovány jsou PNG, JPEG, WebP nebo SVG' })
  }

  let maxSize = 5 * 1024 * 1024
  let minDimensions: [number, number] | null = null
  let outputDir = 'article-images'
  let filenamePrefix = 'article'
  let applyNsfwFilter = false

  if (type === 'client-logo') {
    maxSize = 2 * 1024 * 1024
    minDimensions = [512, 512]
    outputDir = 'client-logos'
    filenamePrefix = `logo-${user?.clientSiteId || 'unknown'}`
  } else if (type === 'user-avatar') {
    minDimensions = [300, 300]
    outputDir = 'avatars'
    filenamePrefix = `avatar-${user?.id || 'unknown'}`
    applyNsfwFilter = true
  } else if (type === 'article-image') {
    outputDir = 'article-images'
    filenamePrefix = 'article'
  }

  if (file.data.length > maxSize) {
    throw createError({ statusCode: 400, message: `Soubor příliš velký (max ${maxSize / 1024 / 1024} MB)` })
  }

  let buffer = file.data
  let filename = `${filenamePrefix}-${Date.now()}.webp`
  if (file.type === 'image/svg+xml') {
    filename = `${filenamePrefix}-${Date.now()}.svg`
  } else if (minDimensions) {
    const img = await sharp(file.data)
    const meta = await img.metadata()
    if (!meta.width || !meta.height || meta.width < minDimensions[0] || meta.height < minDimensions[1]) {
      throw createError({
        statusCode: 400,
        message: `Minimální rozlišení je ${minDimensions[0]}x${minDimensions[1]}px`,
      })
    }
    buffer = await img
      .resize({
        width: minDimensions[0],
        height: minDimensions[1],
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 80 })
      .toBuffer()
  } else {
    buffer = await sharp(file.data).webp({ quality: 80 }).toBuffer()
  }

  if (applyNsfwFilter) {
    const filter = new Filter({ openModeratorAPIKey: openModeratorApiKey })
    const blob = new Blob([Uint8Array.from(buffer)], { type: 'image/webp' })
    const result = await filter.isImageNSFW(blob)
    if (result.nsfw) throw createError({ statusCode: 403, message: 'Nevhodný obsah' })
  }

  const uploadDir = join(process.cwd(), `public/${outputDir}`)
  await mkdir(uploadDir, { recursive: true })
  const filePath = join(uploadDir, filename)
  await writeFile(filePath, buffer)

  if (type === 'client-logo' && user?.clientSiteId) {
    await db.clientSite.update({
      where: { id: user.clientSiteId },
      data: { logoUrl: `/${outputDir}/${filename}` },
    })
  } else if (type === 'user-avatar' && user) {
    await db.user.update({
      where: { id: user.id },
      data: { avatarUrl: `/${outputDir}/${filename}` },
    })
  }

  return { url: `/${outputDir}/${filename}` }
})
