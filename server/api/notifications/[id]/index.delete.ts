export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: 'Chybějící ID notifikace',
    })

  const notification = await prisma.notification.findUnique({
    where: { id },
  })

  if (!notification || notification.userId !== user.id)
    throw createError({
      statusCode: 404,
      statusMessage: 'Notifikace nenalezena',
    })

  await prisma.notification.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  return { success: true }
})
