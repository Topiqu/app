export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'superadmin') throw createError({ statusCode: 403, message: 'Neautorizováno' })

  const db = await getEnhancedPrisma(user)
  return db.user.findMany({
    where: { role: { not: 'superadmin' } },
  })
})
