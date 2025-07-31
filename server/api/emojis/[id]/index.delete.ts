export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'admin') throw createError({ statusCode: 403, message: 'Povoleno pouze pro adminy' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Chybí ID emoji' })

  await prisma.emoji.delete({
    where: { id, clientSiteId: user.clientSiteId },
  })

  return { success: true }
})
