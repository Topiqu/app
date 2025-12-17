import argon from 'argon2'
import { authenticator } from 'otplib'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const { id } = getRouterParams(event)

  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const oldPasswordDb = await prisma.user.findUnique({ where: { id }, select: { password: true, totpSecret: true } })

  const PatchSchema = z.object({
    oldPass: z
      .string()
      .optional()
      .refine((val) => !val || val.length >= 4, {
        message: t('common.passwordSuggestions.tooShort', { minLength: 4 })!,
      }),
    totpAction: z.literal('enable').optional(),
    totpCode: z.string().length(6).optional(),
    username: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().min(4).optional(),
    role: z.enum(['reader', 'admin', 'superadmin']).optional(),
    bio: z.string().optional(),
    language: z.string().optional(),
    allowNotifs: z.boolean().optional(),
    allowEmail: z.boolean().optional(),
    lastLogin: z.coerce.date().optional(),
    avatarUrl: z.string().optional(),
    totpSecret: z.string().nullable().optional(),
    clientSiteId: z.string().nullable().optional(),
  })

  const body = await readValidatedBody(event, PatchSchema.parse)
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
      throw createError({ statusCode: 403, message: t('common.errors.invalidTotp')! })
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

  if (user.role !== 'superadmin' && body.password && oldPasswordDb?.password) {
    const match = await argon.verify(oldPasswordDb.password, oldPass ?? '')
    if (!match) throw createError({ statusCode: 403, message: t('common.errors.passwordChangeFailed')! })
  }

  if (user.role !== 'superadmin' && body.role && body.role !== user.role)
    throw createError({ statusCode: 403, message: t('common.errors.roleChangeForbidden')! })

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
