import { z } from 'zod'
import { articlePath } from '~~/shared/utils/routes'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const schema = z.object({ commentId: z.string().min(1) })
  const body = await readValidatedBody(event, schema.parse)

  const comment = await prisma.comment.findUnique({
    where: { id: body.commentId },
    select: {
      id: true,
      content: true,
      articleId: true,
      article: {
        select: {
          clientSiteId: true,
          slug: true,
          language: true,
          title: true,
          userId: true,
          clientSite: { select: { domain: true, language: true } },
        },
      },
    },
  })
  if (!comment) throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })

  const moderators = (await commentAudience(comment.article, user.id)).filter((member) => member.allowNotifs)
  if (!moderators.length) throw createError({ statusCode: 404, message: t('common.errors.adminNotFound')! })

  const origin = import.meta.dev ? 'http://localhost:3000' : `https://${comment.article.clientSite.domain}`
  const url = `${origin}${articlePath(comment.article.language, comment.article.slug)}#comment-${comment.id}`
  const message = t('common.notifications.userReportedComment', {
    user: user.name || 'Anonymous',
    article: comment.article.title,
  })!

  await prisma.notification.createMany({
    data: moderators.map((member) => ({
      message,
      link: url,
      userId: member.id,
      articleId: comment.articleId,
      type: 'SYSTEM' as const,
    })),
  })

  return { message: t('common.notifications.commentReported')! }
})
