import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { Filter } from 'content-checker'
import sharp from 'sharp'
const { openModeratorApiKey } = useRuntimeConfig()

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.name === 'avatar')
  console.log('KEY:', process.env.OPENMODERATOR_API_KEY)
  if (!file || !file.type?.startsWith('image/'))
    throw createError({ statusCode: 400, statusMessage: 'Neplatný soubor' })

  if (file.data.length > 5 * 1024 * 1024)
    throw createError({ statusCode: 400, statusMessage: 'Soubor příliš velký' })

  const resizedBuffer = await sharp(file.data)
    .resize(300, 300)
    .webp()
    .toBuffer()

  const filter = new Filter({
    openModeratorAPIKey: openModeratorApiKey || '',
  })

  const blob = new Blob([Uint8Array.from(resizedBuffer)], {
    type: 'image/webp',
  })

  const result = await filter.isImageNSFW(blob)
  if (result.nsfw)
    throw createError({ statusCode: 403, statusMessage: 'Nevhodný obsah' })

  const avatarDir = join(process.cwd(), 'public/avatars')
  await mkdir(avatarDir, { recursive: true })

  const filename = `avatar-${Date.now()}.webp`
  const path = join(avatarDir, filename)
  await writeFile(path, resizedBuffer)

  const user = (await getServerSession(event))?.user
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: `/avatars/${filename}` },
    })
  }

  return { url: `/avatars/${filename}` }
})
