import { access, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

export default defineEventHandler(async (event) => {
  const body = await readMultipartFormData(event)
  if (!body || !body.length) return { error: 'Žádný obrázek nebyl nahrán' }

  const file = body[0]

  if (!file.type?.startsWith('image/')) {
    return { error: 'Povoleny jsou pouze obrázky' }
  }

  const uploadDir = join(process.cwd(), 'public/uploads')
  await mkdir(uploadDir, { recursive: true })

  const baseName = (file.filename ?? 'upload').replace(/\.[^/.]+$/, '')
  const filename = `${baseName}.webp`
  const filePath = join(uploadDir, filename)

  try {
    await access(filePath)
    return { success: true, url: `/uploads/${filename}` }
  } catch {
    // proceed
  }

  const webpBuffer = await sharp(file.data).webp({ quality: 80 }).toBuffer()

  await writeFile(filePath, webpBuffer)

  return { success: true, url: `/uploads/${filename}` }
})
