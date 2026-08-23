import { z } from 'zod'
import slugify from 'slugify'

const BodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  excerpt: z.string().max(500).nullable().optional(),
  content: z.string().min(1).max(50000).optional(),
  status: z.enum(['READY', 'PUBLISHED']).optional(),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const body = await readValidatedBody(event, BodySchema.parse)

  const translation = await db.articleTranslation.findFirst({
    where: { id, clientSiteId: user.clientSiteId! },
    select: { id: true, articleId: true, language: true, slug: true, title: true, content: true, status: true },
  })
  if (translation) await requireArticleAccess(event, translation.articleId)
  if (!translation)
    throw createError({ statusCode: 404, message: t('common.errors.notFound') ?? 'Translation not found' })

  const nextTitle = body.title ?? translation.title
  const nextContent = body.content ?? translation.content
  const nextStatus = body.status ?? translation.status

  if (nextStatus === 'PUBLISHED' && (!nextTitle || !nextContent))
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const slug =
    translation.slug ??
    (await dedupeTranslationSlug(
      db,
      slugify(nextTitle!, { lower: true, strict: true, trim: true }),
      user.clientSiteId!,
      translation.language,
      translation.articleId,
    ))

  const updated = await db.articleTranslation.update({
    where: { id: translation.id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.excerpt !== undefined ? { excerpt: body.excerpt } : {}),
      ...(body.content !== undefined ? { content: sanitizeHtml(body.content) } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.title !== undefined || body.excerpt !== undefined || body.content !== undefined
        ? { source: 'HUMAN' as const }
        : {}),
      slug,
      error: null,
    },
    select: {
      id: true,
      language: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      status: true,
      source: true,
    },
  })

  await logAction({
    action: body.status === 'PUBLISHED' ? 'TRANSLATION_PUBLISHED' : 'TRANSLATION_UPDATED',
    userId: user.id,
    clientSiteId: user.clientSiteId!,
    ip: getIp(event),
    metadata: { translationId: updated.id, articleId: translation.articleId, language: updated.language },
  })

  return { translation: updated }
})
