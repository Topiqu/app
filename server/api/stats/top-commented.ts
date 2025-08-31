export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'Uživatel není přiřazen k žádnému ClientSite' })

  const topCommented = await prisma.article.findFirst({
    where: {
      clientSiteId: user.clientSiteId,
      status: 'published',
    },
    select: {
      id: true,
      title: true,
      _count: {
        select: { comments: true },
      },
    },
    orderBy: {
      comments: {
        _count: 'desc',
      },
    },
    take: 1,
  })

  if (!topCommented) return null

  return {
    id: topCommented.id,
    title: topCommented.title,
    comments: topCommented._count.comments,
  }
})
