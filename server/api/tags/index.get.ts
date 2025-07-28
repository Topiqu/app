export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  return await prisma.tag.findMany({
    where: {
      clientSiteId: user.clientSiteId,
    },
  })
})
