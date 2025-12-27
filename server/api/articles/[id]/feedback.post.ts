import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const body = await readBody(event)
  const { isHelpful, reason, sessionId: clientSessionId } = body
  if (typeof isHelpful !== 'boolean') throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)

  const article = await db.article.findUnique({ where: { id: articleId }, select: { id: true } })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  let finalSessionId: string | null = null
  if (!user) {
    finalSessionId = clientSessionId || getCookie(event, 'client_session_id') || randomUUID()
    setCookie(event, 'client_session_id', finalSessionId!, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  }

  const whereClause = user ? { articleId, userId: user.id } : { articleId, sessionId: finalSessionId, userId: null }

  const existingFeedback = await db.articleFeedback.findFirst({ where: whereClause })

  let result
  if (existingFeedback) {
    result = await db.articleFeedback.update({
      where: { id: existingFeedback.id },
      data: { isHelpful, reason: isHelpful ? null : reason || existingFeedback.reason },
    })
  } else {
    result = await db.articleFeedback.create({
      data: {
        articleId,
        isHelpful,
        reason: isHelpful ? null : reason,
        userId: user?.id || null,
        sessionId: user ? null : finalSessionId,
      },
    })
  }

  return { success: true, feedback: result }
})
