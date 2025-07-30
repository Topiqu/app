export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user) throw createError({ status: 401 })
  const id = event.context.params?.id

  await db.article.delete({ where: { id } })
  return { success: true }
})
