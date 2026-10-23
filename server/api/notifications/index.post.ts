import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const schema = z.object({ commentId: z.string().min(1).max(128) })
  const body = await readValidatedBody(event, schema.parse)
  const limits = await Promise.all([
    consumeRateLimit(`comment-report:reader:${user.id}`, 10, 3600),
    consumeRateLimit(`comment-report:ip:${getIp(event)}`, 40, 3600),
  ])
  if (limits.includes(false)) throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  const db = await getEnhancedPrisma(user)

  const comment = await db.comment.findUnique({
    where: { id: body.commentId },
    select: {
      id: true,
      deletedAt: true,
      articleId: true,
      article: {
        select: {
          clientSiteId: true,
          slug: true,
          language: true,
          title: true,
          userId: true,
          status: true,
          deletedAt: true,
          releaseAt: true,
          clientSite: { select: { domain: true, language: true, deletedAt: true } },
        },
      },
    },
  })
  if (!comment || comment.deletedAt || !canReadArticle(user, comment.article))
    throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })

  const accepted = { message: t('common.notifications.commentReported')! }
  // A fixed window keeps a delayed failure from clearing a newer window's claim.
  const reportKey = `comment-report:target:${user.id}:${comment.id}:${Math.floor(Date.now() / 600_000)}`
  if (!(await consumeRateLimit(reportKey, 1, 600))) return accepted

  try {
    const moderators = (await commentAudience(comment.article, user.id)).filter((member) => member.allowNotifs)
    if (!moderators.length) throw createError({ statusCode: 404, message: t('common.errors.adminNotFound')! })

    const origin = import.meta.dev ? 'http://localhost:3000' : `https://${comment.article.clientSite.domain}`
    const url = `${origin}${articlePath(comment.article.language, comment.article.slug)}#comment-${comment.id}`
    const message = t('common.notifications.userReportedComment', {
      user: user.name || 'Anonymous',
      article: comment.article.title,
    })!

    await db.$transaction(async (tx) => {
      for (let start = 0; start < moderators.length; start += 500) {
        await tx.notification.createMany({
          data: moderators.slice(start, start + 500).map((member) => ({
            message,
            link: url,
            userId: member.id,
            articleId: comment.articleId,
            type: 'SYSTEM' as const,
          })),
        })
      }
    })

    return accepted
  } catch (error) {
    await clearRateLimit(reportKey)
    throw error
  }
})
