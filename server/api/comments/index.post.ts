import { CommentCreateSchema } from '~~/shared/databaseSchemas'
import { articlePath } from '~~/shared/utils/routes'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await requireUser(event)

  const body = { ...(await readValidatedBody(event, CommentCreateSchema.parse)) }

  if (body.gifUrl && !body.gifUrl.match(/https:\/\/(media[0-9]*\.)?giphy\.com\/[^)]+\.(gif|mp4|webp)/))
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  body.content = sanitizeHtml(body.content)

  const article = await prisma.article.findUnique({
    where: { id: body.articleId },
    select: {
      clientSiteId: true,
      id: true,
      allowedComments: true,
      userId: true,
      slug: true,
      title: true,
      clientSite: { select: { domain: true, language: true } },
    },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  if (!article.allowedComments) throw createError({ statusCode: 403, message: t('common.errors.commentsDisabled')! })

  const activeBan = await prisma.userBan.findFirst({
    where: {
      userId: user.id,
      clientSiteId: article.clientSiteId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })
  if (activeBan) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const protocol = import.meta.dev ? 'http' : 'https'
  const host = import.meta.dev ? 'localhost:3000' : `${article.clientSite.domain}`

  const articleUrl = `${protocol}://${host}${articlePath(article.clientSite.language, article.slug)}`
  const commentUrl = (id: string) => `${articleUrl}#comment-${id}`
  const replyUrl = articleUrl
  const logoUrl = 'https://cdn.topiqu.com/app-logo.png'

  let content = body.content

  if (body.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: body.parentId },
      select: {
        user: { select: { id: true, language: true, username: true, email: true, allowEmail: true } },
        content: true,
      },
    })
    if (!parent) throw createError({ statusCode: 404, message: t('common.errors.missing')! })
    content = `@${parent.user.username} ${content}`

    if (parent.user.allowEmail && parent.user.email) {
      await sendEmail({
        event,
        to: parent.user.email,
        lang: parent.user.language,
        template: 'commentReply',
        data: {
          userName: user.name,
          parentUsername: parent.user.username,
          commentContent: body.content.slice(0, 50) + '...',
          parentContent: parent.content.slice(0, 50) + '...',
          commentUrl: commentUrl(body.parentId),
          replyUrl,
          avatarUrl: user.avatarUrl || 'https://via.placeholder.com/50',
          logoUrl,
          unsubscribeUrl: unsubscribeUrl(parent.user, `${protocol}://${host}`),
        },
      })
    }
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      gifUrl: body.gifUrl || null,
      articleId: body.articleId,
      userId: user.id,
      parentId: body.parentId || null,
    },
    select: {
      id: true,
      content: true,
      gifUrl: true,
      createdAt: true,
      user: { select: { id: true, username: true, avatarUrl: true } },
      parentId: true,
    },
  })

  const audience = await commentAudience(article, user.id)
  const message = t('common.notifications.userCommentedArticle', [user.name])!
  const notified = audience.filter((member) => member.allowNotifs)
  if (notified.length)
    await prisma.notification.createMany({
      data: notified.map((member) => ({ message, userId: member.id, articleId: article.id, type: 'COMMENT' as const })),
    })

  // One failed mailbox must not fail a comment that is already saved.
  const sent = await Promise.allSettled(
    audience
      .filter((member) => member.allowEmail && member.email)
      .map((member) =>
        sendEmail({
          event,
          to: member.email,
          lang: member.language,
          template: 'newComment',
          data: {
            userName: user.name,
            articleTitle: article.title,
            text: `${user.name}: "${body.content.slice(0, 50)}...".\n${commentUrl(comment.id)}`,
            commentContent: body.content.slice(0, 50) + '...',
            commentUrl: commentUrl(comment.id),
            replyUrl,
            avatarUrl: user.avatarUrl || 'https://via.placeholder.com/50',
            logoUrl,
            unsubscribeUrl: unsubscribeUrl(member, `${protocol}://${host}`),
          },
        }),
      ),
  )
  for (const result of sent) if (result.status === 'rejected') console.error('[newComment email]', result.reason)

  return comment
})
