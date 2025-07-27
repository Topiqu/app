export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  if (user.role !== 'superadmin')
    throw createError({
      statusCode: 403,
      statusMessage: 'Nemáte oprávnění smazat uživatele',
    })

  const userId = getRouterParam(event, 'id')
  if (!userId)
    throw createError({ statusCode: 400, statusMessage: 'Chybí ID uživatele' })

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  })
  if (!targetUser)
    throw createError({ statusCode: 404, statusMessage: 'Uživatel nenalezen' })

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  })

  return { message: 'Uživatel smazán' }
})
