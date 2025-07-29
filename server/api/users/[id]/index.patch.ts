export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  if (user.id !== id) throw createError({ statusCode: 403, statusMessage: 'Nepovolený přístup' })

  const body = await readValidatedBody(event, UserUpdateScalarSchema.parse)
  const lastUpdate = await prisma.user.findUnique({ where: { id }, select: { updatedAt: true } })

  const now = new Date()
  const lastUpdateTime = lastUpdate?.updatedAt || new Date(0)
  const timeDiff = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60)

  if (timeDiff < 1) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Příliš časté aktualizace',
    })
  }

  return await prisma.user.update({
    where: { id },
    data: body,
  })
})
