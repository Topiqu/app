export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'Uživatel není přiřazen k žádnému ClientSite' })

  const totalViews = await prisma.article.aggregate({
    where: { clientSiteId: user.clientSiteId },
    _sum: { views: true },
  })

  return { totalViews: totalViews._sum.views || 0 }
})
