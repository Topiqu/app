export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  const db = await getEnhancedPrisma(user)
  const { commentId, emojiId } = await readBody(event)
  if (!commentId || !emojiId) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const existing = await prisma.emojiReaction.findUnique({
    where: { userId_commentId_emojiId: { userId: user.id, commentId, emojiId } },
  })

  if (existing) {
    await db.emojiReaction.delete({
      where: { userId_commentId_emojiId: { userId: user.id, commentId, emojiId } },
    })
    return { success: true, created: false }
  }

  await db.emojiReaction.create({
    data: { userId: user.id, commentId, emojiId },
  })
  return { success: true, created: true }
})
