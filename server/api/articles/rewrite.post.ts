import { z } from 'zod'
import { TEXT_EDIT_ACTIONS, TEXT_EDIT_MAX_LENGTH } from '~~/shared/utils/aiEdit'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !user.clientSiteId) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  await requireTenantScope(event, 'ARTICLE_WRITE', user.clientSiteId)

  await ensureMinAccountAge(event, user.id)
  await requireAiPlan(user.clientSiteId, t('common.errors.featureNotInPlan')!)

  const { html, action } = await readValidatedBody(
    event,
    z.object({
      html: z.string().trim().nonempty(t('common.errors.missing')!).max(TEXT_EDIT_MAX_LENGTH),
      action: z.enum(TEXT_EDIT_ACTIONS),
    }).parse,
  )
  if (!(await consumeRateLimit(`rewrite-text:${user.clientSiteId}:${user.id}`, 40, 10 * 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  const result = await rewritePassage(sanitizePassage(html), action)
  await recordAiUsage(user.clientSiteId, result.usage.totalTokens ?? 0, 'REWRITE_TEXT', { usage: result.usage, action }, event)
  if (!result.html.trim()) throw createError({ statusCode: 502, message: t('articles.editor.aiEdit.failed')! })
  return { html: result.html }
})
