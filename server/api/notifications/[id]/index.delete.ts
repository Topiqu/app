export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({
      statusCode: 400,
      message: 'Chybějící ID notifikace',
    })

  const notification = await db.notification.findUnique({
    where: { id },
  })

  if (!notification || notification.userId !== user.id)
    throw createError({
      statusCode: 404,
      message: 'Notifikace nenalezena',
    })

  await db.notification.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
  return { success: true }
})
