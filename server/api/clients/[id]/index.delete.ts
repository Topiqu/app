export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user

  const db = await getEnhancedPrisma(user)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID nenalezeno' })

  const { hard } = getQuery(event)
  const forceDelete = hard === 'true'

  if (forceDelete) {
    await db.user.deleteMany({ where: { clientSiteId: id } })
    await db.clientSite.delete({ where: { id } })
  } else {
    await db.user.updateMany({
      where: { clientSiteId: id },
      data: { deletedAt: new Date() },
    })
    await db.clientSite.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  return { success: true }
})
