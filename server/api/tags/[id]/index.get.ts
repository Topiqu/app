export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID je povinné' })
  const { take, skip } = await getPagination(event)

  const tag = await prisma.tag.findUnique({
    where: { id },
    select: { id: true, clientSiteId: true },
  })

  if (!tag) throw createError({ statusCode: 404, message: 'Tag nenalezen' })
  const db = await getEnhancedPrisma(user)

  const articles = await db.articleTag.findMany({
    where: {
      tagId: id,
    },
    take,
    skip,
    include: {
      article: {
        include: {
          tags: { include: { tag: true } },
          user: { select: { id: true, username: true, email: true, role: true } },
        },
      },
    },
  })
  return { ...tag, articles }
})
