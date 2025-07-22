export default defineEventHandler(async () => {
  return await prisma.clientSite.findMany({
    include: {
      users: {
        select: {
          username: true,
          email: true,
        },
      },
    },
  })
})
