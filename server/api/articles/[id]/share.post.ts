export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const body = await readBody(event)

  const article = await prisma.article.findUnique({
    where: { id, status: 'published' },
    select: { id: true, clientSiteId: true },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  await prisma.$transaction(async (tx) => {
    await tx.article.update({
      where: { id },
      data: { shared: { increment: 1 } },
    })

    await tx.articleShare.create({
      data: { articleId: id, platform: body.platform },
    })
  })

  return { success: true }
})
