import { articlePath } from '~~/shared/utils/routes'
import { CommentCreateSchema } from '~~/shared/databaseSchemas'

const emailExcerpt = (content: string) => {
  const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(content)
  return `${Array.from(graphemes, ({ segment }) => segment)
    .slice(0, 50)
    .join('')}...`
}

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
      language: true,
      title: true,
      clientSite: { select: { domain: true, language: true, commentsEnabled: true, commentGifsEnabled: true } },
    },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  if (!article.allowedComments || article.clientSite.commentsEnabled === false)
    throw createError({ statusCode: 403, message: t('common.errors.commentsDisabled')! })
  if (body.gifUrl && article.clientSite.commentGifsEnabled === false)
    throw createError({ statusCode: 403, message: t('common.errors.commentGifsDisabled')! })

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

  const articleUrl = `${protocol}://${host}${articlePath(article.language, article.slug)}`
  const commentUrl = (id: string) => `${articleUrl}#comment-${id}`
  const replyUrl = articleUrl
  const logoUrl = 'https://cdn.topiqu.com/app-logo.png'

  let content = body.content
  const parent = body.parentId
    ? await prisma.comment.findFirst({
        where: { id: body.parentId, articleId: body.articleId },
        select: {
          user: { select: { id: true, language: true, username: true, email: true, allowEmail: true } },
          content: true,
        },
      })
    : null

  if (body.parentId) {
    if (!parent) throw createError({ statusCode: 404, message: t('common.errors.missing')! })
    content = `@${parent.user.username} ${content}`
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
  const sent = await Promise.allSettled([
    ...(parent?.user.allowEmail && parent.user.email
      ? [
          sendEmail({
            event,
            to: parent.user.email,
            lang: parent.user.language,
            template: 'commentReply',
            data: {
              userName: user.name,
              parentUsername: parent.user.username,
              commentContent: emailExcerpt(body.content),
              parentContent: emailExcerpt(parent.content),
              commentUrl: commentUrl(comment.id),
              replyUrl,
              avatarUrl: user.avatarUrl || 'https://via.placeholder.com/50',
              logoUrl,
              unsubscribeUrl: unsubscribeUrl(parent.user, `${protocol}://${host}`),
            },
          }),
        ]
      : []),
    ...audience
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
            text: `${user.name}: "${emailExcerpt(body.content)}".\n${commentUrl(comment.id)}`,
            commentContent: emailExcerpt(body.content),
            commentUrl: commentUrl(comment.id),
            replyUrl,
            avatarUrl: user.avatarUrl || 'https://via.placeholder.com/50',
            logoUrl,
            unsubscribeUrl: unsubscribeUrl(member, `${protocol}://${host}`),
          },
        }),
      ),
  ])
  for (const result of sent) if (result.status === 'rejected') console.error('[comment email]', result.reason)

  return comment
})
