export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.missing')! })

  const followerCount = await prisma.follow.count({
    where: { followed: { clientSiteId: user.clientSiteId } },
  })

  return { count: followerCount }
})
