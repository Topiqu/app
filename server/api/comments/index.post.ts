export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const body = { ...(await readValidatedBody(event, CommentCreateSchema.parse)) }
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

  if (body.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: body.parentId },
      select: { user: { select: { username: true, email: true, allowEmail: true } } },
    })
    if (!parent) throw createError({ statusCode: 404, message: 'Rodičovský komentář nenalezen' })
    content = `@${parent.user.username} ${content}`

    if (parent.user.allowEmail) {
      await useNodeMailer().sendMail({
        from: useRuntimeConfig().from,
        to: parent.user.email,
        subject: 'Nová odpověď na váš komentář',
        text: `Ahoj ${parent.user.username}, ${user.name} odpověděl: "${body.content.slice(0, 50)}...".\nOdpověď najdeš zde: ${url(body.parentId)}`,
        html: `
      <p>Ahoj <b>${parent.user.username}</b>,</p>
      <p><b>${user.name}</b> odpověděl: "<i>${body.content.slice(0, 50)}...</i>"</p>
      <p><a href="${url(body.parentId)}" style="color:#2563eb;text-decoration:none;">➡️ Zobrazit odpověď</a></p>
    `,
      })
    }
  }
  if (fullArticle.allowedComments) {
    const comment = await prisma.comment.create({
      data: { content, articleId: body.articleId, userId: user.id, parentId: body.parentId || null },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, username: true } },
        parentId: true,
      },
    })

    if (fullArticle.userId !== user.id && fullArticle.user.allowEmail) {
      await useNodeMailer().sendMail({
        from: useRuntimeConfig().from,
        to: fullArticle.user.email,
        subject: `Nový komentář – ${fullArticle.title}`,
        text: `Ahoj, ${user.name} okomentoval tvůj článek: "${body.content.slice(0, 50)}...".\nPodívej se zde: ${url(comment.id)}`,
        html: `
      <p>Ahoj,</p>
      <p><b>${user.name}</b> okomentoval tvůj článek: "<i>${body.content.slice(0, 50)}...</i>"</p>
      <p><a href="${url(comment.id)}" style="color:#2563eb;text-decoration:none;">➡️ Zobrazit komentář</a></p>
    `,
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
