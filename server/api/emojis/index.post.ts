export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'admin') throw createError({ statusCode: 403, message: 'Povoleno pouze pro adminy' })

  const body = await readBody(event)
  const { shortcode, imageUrl } = body
  if (!shortcode) throw createError({ statusCode: 400, message: 'Chybí shortcode' })
  if (!imageUrl) throw createError({ statusCode: 400, message: 'Chybí URL obrázku' })

  const emoji = await prisma.emoji.create({
    data: {
      shortcode,
      imageUrl,
      clientSiteId: user.clientSiteId!,
    },
    select: { id: true, shortcode: true, imageUrl: true },
  })

  return { success: true, emoji }
})
