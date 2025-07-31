export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  return await prisma.emoji.findMany({
    where: { clientSiteId: user.clientSiteId },
  })
})
