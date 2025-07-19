export default defineEventHandler(async () => {
  return await prisma.clientSite.findMany({
    orderBy: { createdAt: 'desc' },
  })
})
