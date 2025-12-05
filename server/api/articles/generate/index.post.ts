import { consumeClientTokens } from '~~/server/utils/consumeTokens'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { prompt } = await readValidatedBody(
    event,
    z.object({ prompt: z.string().nonempty(t('common.errors.missing')!) }).parse,
  )

  const { usage, ...article } = await generateArticle(user.clientSiteId, prompt)

  await consumeClientTokens(user.clientSiteId, usage.totalTokens!, 'GENERATE_ARTICLE', { ...article, usage }, event)

  return article
})
