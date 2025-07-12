import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const user = session?.user
  if (!user) throw createError({ status: 401 })
  const id = event.context.params?.id

  await prisma.article.delete({ where: { id } })
  return { success: true }
})
