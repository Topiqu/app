export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  const db = await getEnhancedPrisma(user)
  const { id } = getRouterParams(event)

  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })

  const body = await readValidatedBody(event, UserUpdateScalarSchema.parse)

  return await db.user.update({
    where: { id },
    data: body,
  })
})
