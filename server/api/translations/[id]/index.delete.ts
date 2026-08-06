export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { user, db } = await requireDb(event, { minRole: 'admin', clientSite: true })

  const translation = await db.articleTranslation.findFirst({
    where: { id, clientSiteId: user.clientSiteId! },
    select: { id: true, articleId: true, language: true, status: true },
  })
  if (!translation)
    throw createError({ statusCode: 404, message: t('common.errors.notFound') ?? 'Translation not found' })

  await db.articleTranslation.delete({ where: { id: translation.id } })

  await logAction({
    action: 'TRANSLATION_DISCARDED',
    userId: user.id,
    clientSiteId: user.clientSiteId!,
    ip: getIp(event),
    metadata: { translationId: translation.id, articleId: translation.articleId, language: translation.language },
  })

  return { ok: true }
})
