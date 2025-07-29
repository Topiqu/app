export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID nenalezeno' })

  await prisma.user.updateMany({
    where: { clientSiteId: id },
    data: { deletedAt: new Date() },
  })

  await prisma.clientSite.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  return { success: true }
})
