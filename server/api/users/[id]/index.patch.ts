import argon from 'argon2'
import { authenticator } from 'otplib'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  const db = await getEnhancedPrisma(user)
  const { id } = getRouterParams(event)

  const UserUpdateWithOldPassSchema = z
    .object({
      oldPass: z
        .string()
        .optional()
        .refine((val) => !val || val.length >= 4, { message: 'Staré heslo musí mít alespoň 4 znaky' }),
      totpAction: z.literal('enable').optional(),
      totpCode: z.string().length(6).optional(),
    })
    .extend(UserUpdateSchema.shape)

  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })

  const oldPasswordDb = await prisma.user.findUnique({
    where: { id },
    select: { password: true, totpSecret: true },
  })

  const body = await readValidatedBody(event, UserUpdateWithOldPassSchema.parse)
  const { oldPass, totpAction, totpCode, ...data } = body

  if (totpAction === 'enable') {
    if (oldPasswordDb?.totpSecret) {
      const otpauthUrl = authenticator.keyuri(user.email, 'Topiqu', oldPasswordDb.totpSecret)
      return { otpauthUrl }
    }
    const secret = authenticator.generateSecret()
    const otpauthUrl = authenticator.keyuri(user.email, 'Topiqu', secret)
    await db.user.update({ where: { id }, data: { totpSecret: secret } })
    return { otpauthUrl }
  }

  if (totpCode) {
    const secret = oldPasswordDb?.totpSecret
    if (!secret || !authenticator.verify({ token: totpCode, secret }))
      throw createError({ statusCode: 403, message: 'Neplatný TOTP kód' })
    const updated = await db.user.update({
      where: { id },
      data: { totpSecret: secret },
      select: { id: true, username: true, email: true, role: true, bio: true },
    })
    return { ...updated, verified: true }
  }

  if (body.totpSecret === null) {
    const updated = await db.user.update({
      where: { id },
      data: { totpSecret: null },
      select: { id: true, username: true, email: true, role: true, bio: true },
    })
    return { ...updated, verified: false }
  }

  if (user.role !== 'superadmin' && body.password) {
    if (oldPasswordDb?.password) {
      const match = await argon.verify(oldPasswordDb.password, oldPass ?? '')
      if (!match) throw createError({ statusCode: 403, message: 'Změna hesla selhala' })
    }
  }

  if (user.role !== 'superadmin' && body.role && body.role !== user.role)
    throw createError({ statusCode: 403, message: 'Změna role není povolena' })

  const currentUser = await db.user.findUnique({ where: { id } })

  if (body.role && body.role !== currentUser?.role) {
    if (currentUser?.role === 'admin' && body.role === 'reader') data.clientSiteId = null
    await logAction({
      action: 'ROLE_CHANGE',
      userId: user.id,
      clientSiteId: user.clientSiteId ? user.clientSiteId : undefined,
      ip: getIp(event),
      metadata: { userId: id, newRole: body.role },
    })
  }

  const updated = await saveUserWithLogging(event, { id, ...data }, true)
  return { ...updated }
})
