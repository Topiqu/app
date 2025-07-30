export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  if (user.role !== 'superadmin')
    throw createError({
      statusCode: 403,
      message: 'Nemáte oprávnění zablokovat uživatele',
    })

  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, message: 'Chybí ID uživatele' })

  const targetUser = await db.user.findUnique({
    where: { id: userId },
  })
  if (!targetUser) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  await db.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  })

  return { message: 'Uživatel zablokován' }
})
