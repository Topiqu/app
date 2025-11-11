import type { EventStream } from 'h3'

interface GlobalThis {
  eventStreams?: Map<string, Set<EventStream>>
}

declare const globalThis: GlobalThis

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
      article: { select: { clientSiteId: true, slug: true, title: true, userId: true } },
    },
  })
  if (!comment) throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })

  const admin = await prisma.user.findUnique({
    where: { role: 'admin', id: comment.article.userId, clientSiteId: comment.article.clientSiteId, allowNotifs: true },
    select: { id: true, email: true, username: true },
  })
  if (!admin) throw createError({ statusCode: 404, message: t('common.errors.adminNotFound')! })

  const url = `${import.meta.dev ? 'http://localhost:3000' : 'https://topiqu.com'}/clanky/${comment.article.slug}#comment-${comment.id}`

  const notification = await prisma.notification.create({
    data: {
      message: t('notifications.userReportedComment', {
        user: user.name || 'Anonymous',
        article: comment.article.title,
      })!,
      link: url,
      userId: admin.id,
      articleId: comment.articleId,
      type: 'SYSTEM',
    },
  })

  const streamKey = `notifications:${admin.id}`
  const streams = globalThis.eventStreams?.get(streamKey)
  if (streams) {
    const serialized = JSON.stringify({ ...notification, count: 1 })
    streams.forEach((stream: EventStream) => stream.push(serialized))
  }

  return { message: t('notifications.commentReported')! }
})
