import sharp from 'sharp'
import { join } from 'path'
import { Filter } from 'content-checker'
import { access, mkdir, writeFile } from 'fs/promises'
const { openModeratorApiKey } = useRuntimeConfig()

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)
  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.name === 'file')
  const type = form?.find((f) => f.name === 'type')?.data.toString() || 'article-image'
  const shortcode = form?.find((f) => f.name === 'shortcode')?.data.toString()
  const isAiUser = form?.find((f) => f.name === 'isAiUser')?.data.toString() === 'true'

  const maxSizeFromForm = Number(form?.find((f) => f.name === 'maxSize')?.data.toString())
  const minSizeFromForm = Number(form?.find((f) => f.name === 'minSize')?.data.toString())
  const maxWidthFromForm = Number(form?.find((f) => f.name === 'maxWidth')?.data.toString())
  const maxHeightFromForm = Number(form?.find((f) => f.name === 'maxHeight')?.data.toString())
  const minWidthFromForm = Number(form?.find((f) => f.name === 'minWidth')?.data.toString())
  const minHeightFromForm = Number(form?.find((f) => f.name === 'minHeight')?.data.toString())

  if (
    !file ||
    !file.type?.startsWith('image/') ||
    !['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)
  ) {
    throw createError({ statusCode: 400, message: 'Podporovány jsou PNG, JPEG, WebP nebo SVG' })
  }

  let maxSize = maxSizeFromForm || 5 * 1024 * 1024
  const minSize = minSizeFromForm || 0
  let minDimensions: [number, number] | null = null
  let outputDir = 'article-images'
  let filenamePrefix = 'article'
  let applyNsfwFilter = false
  let filename = `${filenamePrefix}-${Date.now()}.webp`

  if (type === 'client-logo') {
    maxSize = maxSizeFromForm || 2 * 1024 * 1024
    minDimensions = [minWidthFromForm || 512, minHeightFromForm || 512]
    outputDir = 'client-logos'
    filenamePrefix = `logo-${user?.clientSiteId || 'unknown'}`
  } else if (type === 'user-avatar') {
    minDimensions = [minWidthFromForm || 100, minHeightFromForm || 100]
    outputDir = 'avatars'
    filenamePrefix = `avatar-${isAiUser ? Date.now() + (user?.clientSiteId || 'unknown') : user?.id || 'unknown'}`
    applyNsfwFilter = !isAiUser
  } else if (type === 'article-image') {
    minDimensions = [minWidthFromForm || 300, minHeightFromForm || 200]
    outputDir = 'article-images'
    filenamePrefix = 'article'
  } else if (type === 'emoji') {
    if (!shortcode) throw createError({ statusCode: 400, message: 'Chybí shortcode' })
    if (!user || user.role !== 'admin') throw createError({ statusCode: 403, message: 'Povoleno pouze pro adminy' })
    maxSize = maxSizeFromForm || 1 * 1024 * 1024
    minDimensions = [minWidthFromForm || 64, minHeightFromForm || 64]
    outputDir = 'emojis'
    filename = `${shortcode}.webp`
  }

  if (file.data.length > maxSize) {
    throw createError({ statusCode: 400, message: `Soubor příliš velký (max ${maxSize / 1024 / 1024} MB)` })
  }
  if (minSize && file.data.length < minSize) {
    throw createError({ statusCode: 400, message: `Soubor příliš malý (min ${minSize / 1024} KB)` })
  }

  let buffer = file.data
  if (file.type === 'image/svg+xml' && type !== 'emoji') {
    filename = `${filenamePrefix}-${Date.now()}.svg`
  } else {
    const img = sharp(file.data)
    const meta = await img.metadata()

    if (!meta.width || !meta.height) {
      throw createError({ statusCode: 400, message: 'Nepodařilo se zjistit rozměry obrázku' })
    }

    if (minDimensions) {
      if (meta.width < minDimensions[0] || meta.height < minDimensions[1]) {
        throw createError({
          statusCode: 400,
          message: `Minimální rozlišení je ${minDimensions[0]}x${minDimensions[1]}px`,
        })
      }
    }
    if (maxWidthFromForm && meta.width > maxWidthFromForm) {
      throw createError({ statusCode: 400, message: `Maximální šířka je ${maxWidthFromForm}px` })
    }
    if (maxHeightFromForm && meta.height > maxHeightFromForm) {
      throw createError({ statusCode: 400, message: `Maximální výška je ${maxHeightFromForm}px` })
    }

    buffer = await img.webp({ quality: 80 }).toBuffer()
  }

  if (applyNsfwFilter) {
    try {
      const filter = new Filter({ openModeratorAPIKey: openModeratorApiKey })
      const blob = new Blob([Uint8Array.from(buffer)], { type: 'image/webp' })
      const result = await filter.isImageNSFW(blob)
      if (result.nsfw) throw createError({ statusCode: 403, message: 'Nevhodný obsah' })
    } catch (e: any) {
      throw createError({ statusCode: 500, message: `Chyba při kontrole NSFW obsahu ${e.message}` })
    }
  }

  const uploadDir = join(process.cwd(), `public/${outputDir}`)
  await mkdir(uploadDir, { recursive: true })
  const filePath = join(uploadDir, filename)

  if (type === 'emoji') {
    try {
      await access(filePath)
      throw createError({ statusCode: 409, message: 'Emoji s tímto shortcode již existuje' })
    } catch {
      //
    }
  }

  await writeFile(filePath, buffer)

  if (type === 'client-logo' && user?.clientSiteId) {
    await db.clientSite.update({
      where: { id: user.clientSiteId },
      data: { logoUrl: `/${outputDir}/${filename}` },
    })
  } else if (type === 'user-avatar' && user) {
    if (isAiUser && user.clientSiteId) {
      const aiUser = await db.user.findFirst({
        where: { clientSiteId: user.clientSiteId, role: 'ai' },
      })
      if (aiUser) {
        await db.user.update({
          where: { id: aiUser.id },
          data: { avatarUrl: `/${outputDir}/${filename}` },
        })
      } else {
        await prisma.user.create({
          data: {
            username: `ai-${user.clientSiteId}-${Date.now()}`,
            email: `ai-${user.clientSiteId}-${Date.now()}@generated.com`,
            password: null,
            role: 'ai',
            avatarUrl: `/${outputDir}/${filename}`,
            clientSiteId: user.clientSiteId,
          },
        })
      }
    } else {
      await db.user.update({
        where: { id: user.id },
        data: { avatarUrl: `/${outputDir}/${filename}` },
      })
    }
  }

  return { success: true, url: `/${outputDir}/${filename}` }
})
