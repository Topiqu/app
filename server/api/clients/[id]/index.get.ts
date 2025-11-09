export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !['superadmin', 'admin'].includes(user.role))
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const clientSite = await prisma.clientSite.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: 'ai' },
        select: { id: true, username: true, bio: true, avatarUrl: true },
      },
      socials: true,
    },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  return {
    ...clientSite,
    aiUser: clientSite.users[0]
      ? {
          username: clientSite.users[0].username,
          bio: clientSite.users[0].bio,
          avatarUrl: clientSite.users[0].avatarUrl,
        }
      : null,
  }
})
