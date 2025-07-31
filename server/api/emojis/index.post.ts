import sharp from 'sharp'
import { join } from 'path'
import { access, mkdir, writeFile } from 'fs/promises'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'admin') throw createError({ statusCode: 403, message: 'Povoleno pouze pro adminy' })

  const body = await readMultipartFormData(event)
  if (!body || !body.length) throw createError({ statusCode: 400, message: 'Žádný obrázek nebyl nahrán' })

  const file = body.find((f) => f.name === 'image')
  const shortcode = body.find((f) => f.name === 'shortcode')?.data.toString()

  if (!file || !file.type?.startsWith('image/'))
    throw createError({ statusCode: 400, message: 'Povoleny jsou pouze obrázky' })
  if (!shortcode) throw createError({ statusCode: 400, message: 'Chybí shortcode' })

  const uploadDir = join(process.cwd(), 'public/emojis')
  await mkdir(uploadDir, { recursive: true })

  const filename = `${shortcode}.webp`
  const filePath = join(uploadDir, filename)

  try {
    await access(filePath)
    throw createError({ statusCode: 409, message: 'Emoji s tímto shortcode již existuje' })
  } catch {
    // proceed
  }

  const webpBuffer = await sharp(file.data).resize(64, 64).webp({ quality: 80 }).toBuffer()
  await writeFile(filePath, webpBuffer)

  const emoji = await prisma.emoji.create({
    data: {
      shortcode,
      imageUrl: `/emojis/${filename}`,
      clientSiteId: user.clientSiteId!,
    },
    select: { id: true, shortcode: true, imageUrl: true },
  })

  return { success: true, emoji }
})
