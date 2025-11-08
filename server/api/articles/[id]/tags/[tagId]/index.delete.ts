export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const articleId = event.context.params!.id!
  const tagId = event.context.params!.tagId!
  if (!articleId || !tagId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  await prisma.articleTag.delete({ where: { articleId_tagId: { articleId, tagId } } })
  return { success: true }
})
