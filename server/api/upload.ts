import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readMultipartFormData(event)
  if (!body || !body.length) return { error: 'No file' }
  const file = body[0]
  const uploadDir = join(process.cwd(), 'public/uploads')
  await mkdir(uploadDir, { recursive: true })
  const filename = `${Date.now()}-${file.filename}`
  const filePath = join(uploadDir, filename)
  await writeFile(filePath, file.data)
  return { success: true, url: `/uploads/${filename}` }
})
