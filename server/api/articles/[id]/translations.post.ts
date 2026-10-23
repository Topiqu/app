import { z } from 'zod'
import { Language } from '~~/generated/zenstack/models'

const BodySchema = z.object({
  language: z.nativeEnum(Language),
  title: z.string().min(1).max(255),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string().min(1).max(50000),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })
  await requireArticleAccess(event, articleId)
  const body = await readValidatedBody(event, BodySchema.parse)
  const article = await db.article.findFirst({
    where: { id: articleId, clientSiteId: user.clientSiteId! },
    select: { id: true, language: true },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId! },
    select: { language: true },
  })
  if (!clientSite || article.language === body.language)
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const slug = await dedupeTranslationSlug(db, articleSlug(body.title), user.clientSiteId!, body.language, articleId)
  const translation = await db.articleTranslation
    .create({
      data: {
        articleId,
        clientSiteId: user.clientSiteId!,
        language: body.language,
        slug,
        title: body.title,
        excerpt: body.excerpt || null,
        content: sanitizeHtml(body.content),
        status: 'READY',
        source: 'HUMAN',
        translatedAt: new Date(),
      },
      select: translationSelect,
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error))
        throw createError({
          statusCode: 409,
          message: t('articles.editor.history.conflict')!,
          data: { code: 'ARTICLE_EDIT_CONFLICT' },
        })
      throw error
    })

  await syncArticleMediaUsages(prisma, {
    clientSiteId: user.clientSiteId!,
    articleId,
    articleTranslationId: translation.id,
    language: translation.language,
    content: translation.content,
  })

  return { translation }
})
