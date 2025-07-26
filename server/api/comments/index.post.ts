import { CommentCreateSchema } from '~/shared/zod/models'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const body = await readValidatedBody(event, CommentCreateSchema.parse)

  const article = await prisma.article.findUnique({
    where: { id: body.articleId },
  })
  if (!article)
    throw createError({ statusCode: 404, statusMessage: 'Článek nenalezen' })

  let content = body.content
  if (body.parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: body.parentId },
      select: {
        user: { select: { username: true } },
      },
    })
    if (!parentComment)
      throw createError({
        statusCode: 404,
        statusMessage: 'Rodičovský komentář nenalezen',
      })
    content = `@${parentComment.user.username} ${content}`
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
    },
  })

  return comment
})
