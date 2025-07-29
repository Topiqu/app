export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const body = await readValidatedBody(event, CommentCreateSchema.parse)

  body.content = sanitizeHtml(body.content)
  const article = await prisma.article.findUnique({
    where: { id: body.articleId },
    select: { id: true, userId: true, slug: true, user: { select: { clientSite: { select: { subdomain: true } } } } },
  })
  if (!article) throw createError({ statusCode: 404, statusMessage: 'Článek nenalezen' })

  let content = body.content
  if (body.parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: body.parentId },
      select: {
        user: { select: { id: true, username: true, email: true, allowNotifs: true } },
      },
    })
    if (!parentComment)
      throw createError({
        statusCode: 404,
        statusMessage: 'Rodičovský komentář nenalezen',
      })
    content = `@${parentComment.user.username} ${content}`
    if (parentComment.user.allowNotifs) {
      // const t = useNodeMailer()
      // const subdomain = article.user.clientSite?.subdomain || 'localhost:3000'
      // await t.sendMail({
      //   from: useRuntimeConfig().from,
      //   to: parentComment.user.email,
      //   subject: 'Nová odpověď na váš komentář',
      //   text: `Ahoj ${parentComment.user.username},\nuživatel ${user.name} odpověděl na váš komentář: "${body.content.substring(0, 50)}...".\nPodívej se na něj: http://localhost:3000/articles/${article.slug}#${body.parentId}`,
      //   html: `<p>Ahoj <b>${parentComment.user.username}</b>,<br>uživatel <b>${user.name}</b> odpověděl na váš komentář: "<i>${body.content.substring(0, 50)}...</i>".</p><p><a href="http://localhost:3000/articles/${article.slug}#${body.parentId}">Zobrazit odpověď</a></p>`,
      // })
    }
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      articleId: body.articleId,
      userId: user.id,
      parentId: body.parentId || null,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
        },
      },
      parentId: true,
      article: {
        select: {
          slug: true,
        },
      },
    },
  })

  if (article.userId !== user.id) {
    await prisma.notification.create({
      data: {
        message: `Uživatel ${user.name} okomentoval váš článek.`,
        userId: article.userId,
        articleId: article.id,
        type: 'COMMENT',
      },
    })
  }

  return comment
})
