export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const { skip, take } = await getPagination(event)
  const query = getQuery(event).query as string | undefined

  const db = await getEnhancedPrisma(user)

  const [data, total] = await Promise.all([
    db.clientSite.findMany({
      include: {
        users: {
          select: {
            username: true,
            email: true,
          },
        },
      },
      where: {
        ...(query && {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { audience: { contains: query, mode: 'insensitive' } },
            { focus: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    db.clientSite.count({
      where: {
        ...(query && {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { audience: { contains: query, mode: 'insensitive' } },
            { focus: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
    }),
  ])

  return { data, total }
})
