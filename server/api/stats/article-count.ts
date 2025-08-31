export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const articleCount = await prisma.article.count({
    where: { clientSiteId: user.clientSiteId },
  })

  return { articleCount }
})
