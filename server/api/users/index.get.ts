export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const { skip, take } = await getPagination(event)
  const query = getQuery(event).query as string | undefined

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { notIn: ['superadmin', 'ai'] },
        ...(query && {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
      select: { id: true, username: true, email: true, role: true, deletedAt: true, clientSiteId: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.user.count({
      where: {
        role: { notIn: ['superadmin', 'ai'] },
        ...(query && {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        }),
      },
    }),
  ])

  return { data: users, total }
})
