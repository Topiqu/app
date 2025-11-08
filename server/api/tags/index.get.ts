export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  return await prisma.tag.findMany({
    where: {
      clientSiteId: user.clientSiteId,
    },
  })
})
