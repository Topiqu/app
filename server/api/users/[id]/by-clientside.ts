export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { id } = getRouterParams(event)

  if (user.role !== 'superadmin' && user.role !== 'admin')
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const users = await prisma.user.findMany({
    where: { clientSiteId: id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      clientSiteId: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  })

  if (!users.length) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    clientSiteId: u.clientSiteId,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    deletedAt: u.deletedAt,
  }))
})
