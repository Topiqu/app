import { z } from 'zod'
import { PROMPT_EDIT_ACTIONS } from '~~/shared/utils/aiEdit'
import { ARTICLE_GENERATION_FORMATS } from '~~/shared/utils/articleGeneration'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !user.clientSiteId) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)

  await ensureMinAccountAge(event, user.id)
  await requireAiPlan(user.clientSiteId, t('common.errors.featureNotInPlan')!)

  const { prompt, action, format } = await readValidatedBody(
    event,
    z.object({
      // Capped so the endpoint cannot be used to push an arbitrary payload through the model.
      prompt: z.string().trim().nonempty(t('common.errors.missing')!).max(5000),
      action: z.enum(PROMPT_EDIT_ACTIONS).default('sharpen'),
      format: z.enum(ARTICLE_GENERATION_FORMATS).optional(),
    }).parse,
  )
  if (!(await consumeRateLimit(`enhance-prompt:${user.clientSiteId}:${user.id}`, 30, 10 * 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  if (action === 'questions') {
    const { questions, usage } = await briefQuestions(prompt, format)
    await recordAiUsage(user.clientSiteId, usage.totalTokens ?? 0, 'ENHANCE_PROMPT', { usage, action }, event)
    return { questions }
  }
  const { text, usage } = await enhancePrompt(prompt, action)
  await recordAiUsage(user.clientSiteId, usage.totalTokens ?? 0, 'ENHANCE_PROMPT', { usage, action }, event)
  return { prompt: text }
})
