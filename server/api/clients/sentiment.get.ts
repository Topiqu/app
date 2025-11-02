export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'Chybí ID' })

  const site = await prisma.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: { communityInsight: true },
  })
  if (!site) throw createError({ statusCode: 404, message: 'Nenalezeno' })
  return site?.communityInsight
})
