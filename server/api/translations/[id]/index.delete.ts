import { z } from 'zod'

const bodySchema = z.object({ expectedUpdatedAt: z.iso.datetime().nullable().optional() })

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })
  const body = await readValidatedBody(event, bodySchema.parse)
  if (body.expectedUpdatedAt === undefined)
    throw createError({
      statusCode: 428,
      message: t('articles.editor.history.versionRequired')!,
      data: { code: 'ARTICLE_VERSION_REQUIRED' },
    })

  const translation = await db.articleTranslation.findFirst({
    where: { id, clientSiteId: user.clientSiteId! },
    select: { id: true, articleId: true, language: true, status: true },
  })
  if (!translation)
    throw createError({ statusCode: 404, message: t('common.errors.notFound') ?? 'Translation not found' })
  await requireArticleAccess(event, translation.articleId)
  if (translation.status === 'PUBLISHED') await requireTenantScope(event, 'ARTICLE_PUBLISH')

  const removed = await db.articleTranslation.deleteMany({
    where: {
      id: translation.id,
      clientSiteId: user.clientSiteId!,
      status: translation.status,
      updatedAt: body.expectedUpdatedAt === null ? null : new Date(body.expectedUpdatedAt),
    },
  })
  if (removed.count !== 1)
    throw createError({
      statusCode: 409,
      message: t('articles.editor.history.conflict')!,
      data: { code: 'ARTICLE_EDIT_CONFLICT' },
    })
  await invalidateFeed(user.clientSiteId!)

  try {
    await logAction({
      action: 'TRANSLATION_DISCARDED',
      userId: user.id,
      clientSiteId: user.clientSiteId!,
      ip: getIp(event),
      metadata: { translationId: translation.id, articleId: translation.articleId, language: translation.language },
    })
  } catch (error) {
    await reportCaughtError('Translation discard audit failed after persistence', error, {
      translationId: translation.id,
      clientSiteId: user.clientSiteId!,
    })
  }

  return { ok: true }
})
