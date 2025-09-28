import argon from 'argon2'
import { zxcvbn } from '@zxcvbn-ts/core'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)
  if (!user || user.role !== 'superadmin') throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const body = await readBody(event)
  const { username, email, password, role, clientSiteId } = body

  if (!username || !email || !password || !role || !clientSiteId)
    throw createError({ statusCode: 400, message: 'Chybí povinná pole' })

  const [existingUser, existingClientSite] = await Promise.all([
    db.user.findFirst({
      where: { OR: [{ email }, { username }], deletedAt: null },
    }),
    db.clientSite.findUnique({ where: { id: clientSiteId } }),
  ])

  if (existingUser)
    throw createError({
      statusCode: 409,
      message: 'Uživatel s tímto emailem nebo jménem již existuje',
    })

  if (!existingClientSite) throw createError({ statusCode: 404, message: 'Klient nenalezen' })

  const strength = zxcvbn(password).score
  const hashedPassword = await argon.hash(password)
  const ip = getIp(event)

  const newUser = await db.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
        clientSiteId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        clientSiteId: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    })

    return createdUser
  })

  await logAction({
    action: 'USER_CREATE',
    userId: newUser.id,
    clientSiteId,
    ip,
    metadata: { username, email },
  })

  await logAction({
    action: 'PASSWORD_SET',
    userId: newUser.id,
    clientSiteId,
    ip,
    metadata: { userId: newUser.id, passwordStrength: strength },
  })

  return newUser
})
