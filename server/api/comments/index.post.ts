export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const body = { ...(await readValidatedBody(event, CommentCreateSchema.parse)) }

  if (body.gifUrl && !body.gifUrl.match(/https:\/\/(media[0-9]*\.)?giphy\.com\/[^)]+\.(gif|mp4|webp)/)) {
    throw createError({ statusCode: 400, message: 'Neplatné GIF URL' })
  }

  body.content = sanitizeHtml(body.content)

  const article = await prisma.article.findUnique({
    where: { id: body.articleId },
    select: { clientSiteId: true },
  })
  if (!article) throw createError({ statusCode: 404, message: 'Článek nenalezen' })

  const activeBan = await prisma.userBan.findFirst({
    where: {
      userId: user.id,
      clientSiteId: article.clientSiteId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })
  if (activeBan) throw createError({ statusCode: 403, message: 'Nemůžete přidat komentář, jste zabanován' })

  const fullArticle = await prisma.article.findUnique({
    where: { id: body.articleId },
    select: {
      id: true,
      userId: true,
      slug: true,
      title: true,
      allowedComments: true,
      user: { select: { email: true, allowEmail: true } },
    },
  })
  if (!fullArticle) throw createError({ statusCode: 404, message: 'Článek nenalezen' })

  let content = body.content
  const url = (id: string) => `http://localhost:3000/clanky/${fullArticle.slug}#comment-${id}`
  const replyUrl = `http://localhost:3000/clanky/${fullArticle.slug}/reply`
  const logoUrl = 'https://via.placeholder.com/150x50'
  const unsubscribeUrl = 'http://localhost:3000/uzivatel'

  if (body.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: body.parentId },
      select: {
        user: { select: { username: true, email: true, allowEmail: true, avatarUrl: true } },
        content: true,
      },
    })
    if (!parent) throw createError({ statusCode: 404, message: 'Rodičovský komentář nenalezen' })
    content = `@${parent.user.username} ${content}`

    if (parent.user.allowEmail) {
      await sendEmail({
        to: parent.user.email,
        template: 'commentReply',
        data: {
          subject: 'Nová odpověď na váš komentář',
          text: `Ahoj ${parent.user.username}, ${user.name} odpověděl: "${body.content.slice(0, 50)}...".\nOdpověď najdeš zde: ${url(body.parentId)}`,
          userName: user.name,
          parentUsername: parent.user.username,
          commentContent: body.content.slice(0, 50) + '...',
          parentContent: parent.content.slice(0, 50) + '...',
          commentUrl: url(body.parentId),
          replyUrl,
          avatarUrl: user.avatarUrl || 'https://via.placeholder.com/50',
          logoUrl,
          unsubscribeUrl,
        },
      })
    }
  }

  if (fullArticle.allowedComments) {
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

    if (fullArticle.userId !== user.id && fullArticle.user.allowEmail) {
      await sendEmail({
        to: fullArticle.user.email,
        template: 'newComment',
        data: {
          subject: `Nový komentář – ${fullArticle.title}`,
          text: `Ahoj, ${user.name} okomentoval tvůj článek: "${body.content.slice(0, 50)}...".\nPodívej se zde: ${url(comment.id)}`,
          userName: user.name,
          articleTitle: fullArticle.title,
          commentContent: body.content.slice(0, 50) + '...',
          commentUrl: url(comment.id),
          replyUrl,
          avatarUrl: user.avatarUrl || 'https://via.placeholder.com/50',
          logoUrl,
          unsubscribeUrl,
        },
      })

      await prisma.notification.create({
        data: {
          message: `${user.name} okomentoval váš článek.`,
          userId: fullArticle.userId,
          articleId: fullArticle.id,
          type: 'COMMENT',
        },
      })
    }
    return comment
  } else throw createError('Psaní komentářů není povoleno.')
})
