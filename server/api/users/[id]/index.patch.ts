import argon from 'argon2'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  const db = await getEnhancedPrisma(user)
  const { id } = getRouterParams(event)

  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })

  const body = await readValidatedBody(event, UserUpdateScalarSchema.parse)

  if (user.role !== 'superadmin') {
    if (body.role && body.role !== user.role)
      throw createError({ statusCode: 403, message: 'Změna role není povolena' })
  }

  const data: any = {
    username: body.username,
    email: body.email,
  }

  if (body.password) {
    data.password = await argon.hash(body.password)
  }

  return await db.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
    },
  })
})
