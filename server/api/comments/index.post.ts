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

  if (body.parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: body.parentId },
    })
    if (!parentComment)
      throw createError({
        statusCode: 404,
        statusMessage: 'Rodičovský komentář nenalezen',
      })
  }

  const comment = await prisma.comment.create({
    data: {
      content: body.content,
      articleId: body.articleId,
      userId: user.id,
      parentId: body.parentId,
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: {
        select: {
          username: true,
        },
      },
    },
  })

  return comment
})
