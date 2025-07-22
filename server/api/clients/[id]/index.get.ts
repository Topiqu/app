export default defineEventHandler(async (event) => {
  const id = await getRouterParam(event, 'id')
  return await prisma.clientSite.findUnique({
    where: {
      id,
    },
  })
})
