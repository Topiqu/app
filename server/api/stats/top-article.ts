import { getServerSession } from '#auth'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const topArticle = await prisma.article.findFirst({
    where: { userId: user.id },
    select: { id: true, title: true, views: true },
    orderBy: { views: 'desc' },
    take: 1,
  })

  return topArticle || null
})
