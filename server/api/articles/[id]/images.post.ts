/** Starts picking new pictures for a saved article; `GET` on the same path returns the proposal. */
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const access = await requireTenantScope(event, 'ARTICLE_WRITE')
  if (!hasTenantScope(access.membership, 'AI_USE'))
    throw createError({ statusCode: 403, message: 'Missing tenant scope: AI_USE' })
  await requireAiPlan(access.user.clientSiteId!, t('common.errors.featureNotInPlan')!)

  const pick = await startImagePick(event, await imagePickArticle(event, access, t), access.user.id, t)
  if (!pick) throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  setResponseStatus(event, 202)
  return pick
})
