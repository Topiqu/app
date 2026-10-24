import { z } from 'zod'

const bodySchema = z.object({
  commentId: z.string().min(1).max(128),
  emojiId: z.string().min(1).max(128),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  const { commentId, emojiId } = await readValidatedBody(event, bodySchema.parse)
  const db = await getEnhancedPrisma(user)

  return db.$transaction(async (tx) => {
    const comment = await tx.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        deletedAt: true,
        article: {
          select: {
            clientSiteId: true,
            status: true,
            deletedAt: true,
            releaseAt: true,
            allowedComments: true,
            clientSite: { select: { deletedAt: true, commentsEnabled: true } },
          },
        },
      },
    })
    if (!comment || comment.deletedAt || !canReadArticle(user, comment.article))
      throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })
    const emoji = await tx.emoji.findUnique({
      where: { id: emojiId },
      select: { id: true, clientSiteId: true, deletedAt: true },
    })
    if (!emoji || emoji.deletedAt || emoji.clientSiteId !== comment.article.clientSiteId)
      throw createError({ statusCode: 404, message: t('common.errors.notFound')! })
    if (!comment.article.allowedComments || !comment.article.clientSite.commentsEnabled)
      throw createError({ statusCode: 403, message: t('common.errors.commentsDisabled')! })
    const ban = await tx.userBan.findFirst({
      where: {
        userId: user.id,
        clientSiteId: comment.article.clientSiteId,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    })
    if (ban) throw createError({ statusCode: 403, message: t('articles.comments.postingBanned')! })

    // Serialize toggles of this one identity across replicas; no remote work runs under this lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`emoji-reaction:${user.id}:${commentId}:${emojiId}`}))`
    const where = { userId_commentId_emojiId: { userId: user.id, commentId, emojiId } }
    const existing = await tx.emojiReaction.findUnique({ where, select: { userId: true } })
    if (existing) {
      await tx.emojiReaction.delete({ where })
      return { success: true, created: false }
    }
    await tx.emojiReaction.create({
      data: { userId: user.id, commentId, emojiId },
      select: { userId: true },
    })
    return { success: true, created: true }
  })
})
