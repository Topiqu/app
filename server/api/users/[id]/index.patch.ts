import argon from 'argon2'
import { authenticator } from 'otplib'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  const db = await getEnhancedPrisma(user)
  const { id } = getRouterParams(event)

  const UserUpdateWithOldPassSchema = UserUpdateSchema.extend({
    oldPass: z
      .string()
      .optional()
      .refine((val) => !val || val.length >= 4, {
        message: 'Staré heslo musí mít alespoň 4 znaky',
      }),
    totpAction: z.literal('enable').optional(),
    totpCode: z.string().length(6).optional(),
  })

  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })

  const oldPasswordDb = await prisma.user.findUnique({
    where: { id },
    select: { password: true, totpSecret: true },
  })

  const body = await readValidatedBody(event, UserUpdateWithOldPassSchema.parse)
  const { oldPass, totpAction, totpCode, totpSecret, ...data } = body

  if (totpAction === 'enable') {
    const secret = authenticator.generateSecret()
    data.totpSecret = secret
    const otpauthUrl = authenticator.keyuri(user.email, 'Topiqu', secret)
    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        bio: true,
      },
    })
    return { ...updated, otpauthUrl }
  }

  if (totpCode) {
    if (!authenticator.verify({ token: totpCode, secret: oldPasswordDb?.totpSecret ?? '' })) {
      throw createError({ statusCode: 403, message: 'Neplatný TOTP kód' })
    }
    return { verified: true }
  }

  if (totpSecret === null) {
    data.totpSecret = null
  }

  if (user.role !== 'superadmin' && body.password) {
    if (oldPasswordDb?.password) {
      const match = await argon.verify(oldPasswordDb.password, oldPass ?? '')
      if (!match) {
        throw createError({ statusCode: 403, message: 'Změna hesla selhala' })
      }
    }
  }

  if (user.role !== 'superadmin' && body.role && body.role !== user.role) {
    throw createError({ statusCode: 403, message: 'Změna role není povolena' })
  }

  if (body.password) {
    data.password = await argon.hash(body.password, {
      type: argon.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    })
  }

  const ip = getIp(event)
  const currentUser = await db.user.findUnique({ where: { id } })

  if (body.role && body.role !== currentUser?.role) {
    await logAction({
      action: 'ROLE_CHANGE',
      userId: user.id,
      clientSiteId: user.clientSiteId,
      ip,
      metadata: { userId: id, newRole: body.role },
    })

    if (currentUser?.role === 'admin' && body.role === 'reader') {
      data.clientSiteId = null
    }
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
    data,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      bio: true,
    },
  })
})
