export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const tagId = getRouterParam(event, 'id')
  if (!tagId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  await prisma.tag.delete({ where: { id: tagId } })
  return { success: true }
})
