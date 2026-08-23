import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const articleId = event.context.params!.id!
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  await requireArticleAccess(event, articleId)

  const body = await readValidatedBody(event, z.object({ tagId: z.string() }).parse)

  const article = await db.article.findUnique({ where: { id: articleId }, select: { id: true } })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const tag = await db.tag.findFirst({
    where: { id: body.tagId, clientSiteId: user.clientSiteId },
    select: { id: true },
  })
  if (!tag) throw createError({ statusCode: 404, message: t('common.errors.tagNotFound')! })

  await db.articleTag.create({ data: { articleId, tagId: tag.id } })
  return { success: true }
})
