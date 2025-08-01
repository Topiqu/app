export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'superadmin') throw createError({ statusCode: 403, message: 'Neautorizováno' })

  return prisma.user.findMany({
    where: { role: { not: 'superadmin' } },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      deletedAt: true,
    },
  })
})
