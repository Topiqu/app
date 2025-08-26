export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const { skip, take } = await getPagination(event)

  return prisma.article.findMany({
    where: session ? { userId: session.user.id } : {},
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  })
})
