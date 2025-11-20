export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { id } = getRouterParams(event)
  const userData = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: { select: { comments: true, followers: true, following: true } },
      reactions: true,
    },
  })

  if (!userData) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })

  return {
    username: userData.username,
    avatarUrl: userData.avatarUrl,
  }
})
