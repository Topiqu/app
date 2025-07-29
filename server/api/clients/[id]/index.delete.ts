export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID nenalezeno' })

  const { hard } = getQuery(event)
  const forceDelete = hard === 'true'

  if (forceDelete) {
    await prisma.user.deleteMany({ where: { clientSiteId: id } })
    await prisma.clientSite.delete({ where: { id } })
  } else {
    await prisma.user.updateMany({
      where: { clientSiteId: id },
      data: { deletedAt: new Date() },
    })
    await prisma.clientSite.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  return { success: true }
})
