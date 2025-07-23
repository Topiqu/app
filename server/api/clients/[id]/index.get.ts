export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  return await prisma.clientSite.findUnique({
    where: {
      id,
    },
  })
})
