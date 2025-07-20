export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const totalViews = await prisma.article.aggregate({
    where: { userId: user.id },
    _sum: { views: true },
  })

  return { totalViews: totalViews._sum.views || 0 }
})
