import { z } from 'zod'
import slugify from 'slugify'
import { Language } from '@prisma/client'

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
    select: { id: true },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  const clientSite = await db.clientSite.findUnique({
    where: { id: user.clientSiteId! },
    select: { language: true },
  })
  if (!clientSite || clientSite.language === body.language)
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const slug = await dedupeTranslationSlug(
    db,
    slugify(body.title, { lower: true, strict: true, trim: true }),
    user.clientSiteId!,
    body.language,
    articleId,
  )
  const translation = await db.articleTranslation.upsert({
    where: { articleId_language: { articleId, language: body.language } },
    create: {
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
    update: {
      slug,
      title: body.title,
      excerpt: body.excerpt || null,
      content: sanitizeHtml(body.content),
      status: 'READY',
      source: 'HUMAN',
      error: null,
      translatedAt: new Date(),
    },
  })

  return { translation }
})
