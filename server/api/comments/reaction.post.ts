export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const body = await readValidatedBody(event, CommentReactionSchema.omit({ userId: true }).parse)

  const comment = await prisma.comment.findUnique({
    where: { id: body.commentId, deletedAt: null },
  })
  if (!comment) throw createError({ statusCode: 404, message: 'Komentář nenalezen' })

  const existingReaction = await prisma.commentReaction.findUnique({
    where: { userId_commentId: { userId: user.id, commentId: body.commentId } },
  })

  if (existingReaction) {
    if (existingReaction.type === body.type) {
      await prisma.commentReaction.delete({
        where: {
          userId_commentId: { userId: user.id, commentId: body.commentId },
        },
      })
      return { message: 'Reakce odebrána' }
    } else {
      await prisma.commentReaction.update({
        where: {
          userId_commentId: { userId: user.id, commentId: body.commentId },
        },
        data: { type: body.type },
      })
      return { message: 'Reakce aktualizována' }
    }
  }

  const reaction = await prisma.commentReaction.create({
    data: {
      userId: user.id,
      commentId: body.commentId,
      type: body.type,
    },
    select: {
      userId: true,
      commentId: true,
      type: true,
    },
  })

  return reaction
})
