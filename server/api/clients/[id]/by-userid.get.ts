export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'id')
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      clientSite: true,
    },
  })
  return user?.clientSite ?? null
})
