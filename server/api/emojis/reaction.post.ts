export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const { commentId, emojiId } = await readBody(event)
  if (!commentId || !emojiId) throw createError({ statusCode: 400, message: 'Chybí commentId nebo emojiId' })

  const existing = await prisma.emojiReaction.findUnique({
    where: { userId_commentId_emojiId: { userId: user.id, commentId, emojiId } },
  })

  if (existing) {
    await prisma.emojiReaction.delete({
      where: { userId_commentId_emojiId: { userId: user.id, commentId, emojiId } },
    })
    return { success: true, created: false }
  }

  await prisma.emojiReaction.create({
    data: { userId: user.id, commentId, emojiId },
  })
  return { success: true, created: true }
})
