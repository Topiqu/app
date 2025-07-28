export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const articleCount = await prisma.article.count({
    where: { userId: user.id },
  })

  return { articleCount }
})
