import { z } from 'zod'
import { consumeClientTokens } from '~~/server/utils/consumeTokens'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !user.clientSiteId) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }

  await ensureMinAccountAge(event, user.id)

  const { prompt } = await readValidatedBody(
    event,
    z.object({
      // Capped so the endpoint cannot be used to push an arbitrary payload through the model.
      prompt: z.string().trim().nonempty(t('common.errors.missing')!).max(2000),
    }).parse,
  )

  const { text, usage } = await enhancePrompt(prompt)

  await consumeClientTokens(user.clientSiteId, usage.totalTokens ?? 0, 'ENHANCE_PROMPT', {}, event)

  return { prompt: text }
})
