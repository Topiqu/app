export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  return await prisma.articleTag.findMany({
    where: { articleId },
    include: { tag: true },
  })
})
