import { ArticleStatus } from '~~/generated/zenstack/models'
import { throwAiAllowanceMessage } from '~~/server/utils/ai/allowanceError'

/** Proposes new pictures for a saved article; the editor saves them through the usual article update. */
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const clientSiteId = user.clientSiteId!
  if (!hasTenantScope(membership, 'AI_USE'))
    throw createError({ statusCode: 403, message: 'Missing tenant scope: AI_USE' })
  await requireAiPlan(clientSiteId, t('common.errors.featureNotInPlan')!)

  const id = getRouterParam(event, 'id')
  const db = await getEnhancedPrisma(user)
  const article = id
    ? await db.article.findUnique({
        where: { id },
        select: {
          id: true,
          clientSiteId: true,
          userId: true,
          status: true,
          title: true,
          excerpt: true,
          content: true,
          language: true,
        },
      })
    : null
  if (!article || article.clientSiteId !== clientSiteId)
    throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  if (article.userId !== user.id && !hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS'))
    throw createError({ statusCode: 403, message: t('common.errors.articleEditForbidden')! })
  if (!(await consumeRateLimit(`article-images:${clientSiteId}:${user.id}`, 20, 60 * 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  const result = await withAiAllowance(clientSiteId, 'EDIT', () =>
    withAiSpend(clientSiteId, () =>
      repickArticleImages(clientSiteId, { ...article, published: article.status === ArticleStatus.published }),
    ),
  ).catch((error) => throwAiAllowanceMessage(error, t))
  await recordAiUsage(clientSiteId, result.tokens, 'ARTICLE_IMAGES', { articleId: id }, event, user.id)
  return { content: result.content, imageUrl: result.imageUrl, coverMediaId: result.coverMediaId }
})
