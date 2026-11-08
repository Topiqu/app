import { z } from 'zod'

const STATUS = { invalid: 400, notFound: 404, unavailable: 502 } as const

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const { url } = await readValidatedBody(event, z.object({ url: z.string().trim().min(10).max(500) }).parse)
  const [byUser, byIp] = await Promise.all([
    consumeRateLimit(`x-post:user:${user.id}`, 60, 60 * 60),
    consumeRateLimit(`x-post:ip:${getIp(event)}`, 60, 60 * 60),
  ])
  const { translate: t } = await useServerI18n(event)
  if (!byUser || !byIp)
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests') || 'Too many requests' })
  try {
    // The language only formats a date in markup that is discarded.
    return await fetchXPost(url, 'en')
  } catch (error) {
    if (!(error instanceof XPostError)) throw error
    throw createError({
      statusCode: STATUS[error.code],
      message: t(`articles.editor.xPost.errors.${error.code}`) || error.code,
    })
  }
})
