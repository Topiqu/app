import { z } from 'zod'

const InputSchema = z.object({
  isHelpful: z.boolean(),
  reason: z.string().trim().max(500).nullish(),
})

const feedbackSelect = { id: true, articleId: true, isHelpful: true, reason: true } as const

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)

  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { isHelpful, reason } = await readValidatedBody(event, InputSchema.parse)

  const db = await getEnhancedPrisma(user)

  const article = await db.article.findUnique({
    where: {
      id: articleId,
      status: 'published',
      deletedAt: null,
      clientSite: { deletedAt: null },
      OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }],
    },
    select: { id: true },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  let finalSessionId: string | null = null
  if (!user) {
    finalSessionId = issueAnonSession(event)
  }

  const whereClause = user
    ? { articleId, userId: user.id, sessionId: null }
    : { articleId, sessionId: finalSessionId, userId: null }

  const existingFeedback = await db.articleFeedback.findFirst({ where: whereClause, select: feedbackSelect })

  // Anonymous updates are authorized here by the server-issued cookie and the visible article.
  // Keep the public model policy closed; the raw write below always repeats the complete identity.
  const writable = user ? db : prisma
  const updateFeedback = (existing: { id: string }) =>
    writable.articleFeedback.update({
      where: { id: existing.id, ...whereClause },
      data: { isHelpful, reason: isHelpful ? null : reason || undefined },
      select: feedbackSelect,
    })

  let result
  if (existingFeedback) {
    result = await updateFeedback(existingFeedback)
  } else {
    try {
      result = await db.articleFeedback.create({
        data: { ...whereClause, isHelpful, reason: isHelpful ? null : reason },
        select: feedbackSelect,
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const concurrent = await db.articleFeedback.findFirst({ where: whereClause, select: feedbackSelect })
      if (!concurrent) throw error
      result = await updateFeedback(concurrent)
    }
  }

  return { success: true, feedback: result }
})
