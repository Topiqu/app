export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID nenalezeno' })

  await prisma.clientSite.delete({ where: { id } })
  return { success: true }
})
