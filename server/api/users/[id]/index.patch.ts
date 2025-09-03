import argon from 'argon2'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  const db = await getEnhancedPrisma(user)
  const { id } = getRouterParams(event)

  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })

  const body = await readValidatedBody(event, UserUpdateSchema.parse)

  if (user.role !== 'superadmin') {
    if (body.password) throw createError({ statusCode: 403, message: 'Změna hesla povolena pouze superadminovi' })
    if (body.role && body.role !== user.role)
      throw createError({ statusCode: 403, message: 'Změna role není povolena' })
  }

  if (body.password) body.password = await argon.hash(body.password)

  const ip = getIp(event)

  if (body.role && body.role !== (await db.user.findUnique({ where: { id } }))?.role) {
    await logAction({
      action: 'ROLE_CHANGE',
      userId: user.id,
      clientSiteId: user.clientSiteId,
      ip,
      metadata: { userId: id, newRole: body.role },
    })
  }

  if (body.password) {
    await logAction({
      action: 'PASSWORD_CHANGE',
      userId: user.id,
      clientSiteId: user.clientSiteId ? user.clientSiteId : undefined,
      ip,
      metadata: { userId: id },
    })
  }

  return await db.user.update({
    where: { id },
    data: body,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      bio: true,
    },
  })
})
