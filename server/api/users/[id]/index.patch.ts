import { z } from 'zod'
import argon from 'argon2'
import { authenticator } from 'otplib'
import { LanguageSchema } from '~~/shared/siteSchemas'
import { BIO_MAX_LENGTH } from '~~/shared/utils/profile'

const REAUTH_WINDOW_MS = 10 * 60 * 1000

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const { id } = getRouterParams(event) as { id: string }

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
    totpAction: z.enum(['enable', 'disable']).optional(),
    totpCode: z.string().length(6).optional(),
    totpSetup: z.string().optional(),
    username: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().min(4).optional(),
    role: z.enum(['reader', 'admin', 'superadmin']).optional(),
    bio: z.string().max(BIO_MAX_LENGTH).nullable().optional(),
    language: LanguageSchema.optional(),
    allowNotifs: z.boolean().optional(),
    allowEmail: z.boolean().optional(),
    lastLogin: z.coerce.date().optional(),
    avatarUrl: z.url().nullable().optional(),
    clientSiteId: z.string().nullable().optional(),
  })

  const body = await readValidatedBody(event, PatchSchema.parse)
  const { oldPass, totpAction, totpCode, totpSetup, ...data } = body
  const self = user.id === id

  const requireTotp = async (secret: string | null | undefined) => {
    const result = await checkTotpCode(id, secret, totpCode)
    if (result === 'limited') throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
    if (result === 'invalid') throw createError({ statusCode: 403, message: t('common.errors.invalidTotp')! })
  }

  if (totpAction === 'enable') {
    if (!self) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
    if (oldPasswordDb?.totpSecret) throw createError({ statusCode: 409, message: t('common.errTypes.conflict')! })
    const secret = authenticator.generateSecret()
    return { otpauthUrl: authenticator.keyuri(user.email, 'Topiqu', secret), totpSetup: signTotpSetup(id, secret) }
  }

  if (totpSetup) {
    if (!self) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
    const secret = verifyTotpSetup(totpSetup, id)
    await requireTotp(secret)
    // Guarded on null: a second setup must not swap out an authenticator the user already confirmed.
    const { count } = await db.user.updateMany({ where: { id, totpSecret: null }, data: { totpSecret: secret } })
    if (!count) throw createError({ statusCode: 409, message: t('common.errTypes.conflict')! })
    return { verified: true }
  }

  if (totpAction === 'disable') {
    // A superadmin clearing someone else's 2FA is account recovery; everyone else proves the factor.
    if (self) await requireTotp(oldPasswordDb?.totpSecret)
    await db.user.update({ where: { id }, data: { totpSecret: null } })
    return { verified: false }
  }

  if (user.role !== 'superadmin' && body.password) {
    if (oldPasswordDb?.password) {
      const match = await argon.verify(oldPasswordDb.password, oldPass ?? '')
      if (!match) throw createError({ statusCode: 403, message: t('common.errors.passwordChangeFailed')! })
    } else {
      // No current password to check, so a recent sign-in is the only proof the owner is at the keyboard.
      const session = user.sessionId
        ? await prisma.session.findFirst({
            where: { id: user.sessionId, userId: id },
            select: { createdAt: true },
          })
        : null
      if (!session || Date.now() - session.createdAt.getTime() > REAUTH_WINDOW_MS)
        throw createError({ statusCode: 403, message: t('common.errors.reauthRequired')! })
    }
  }

  if (user.role !== 'superadmin' && body.role && body.role !== user.role)
    throw createError({ statusCode: 403, message: t('common.errors.roleChangeForbidden')! })

  if (user.role !== 'superadmin' && body.clientSiteId !== undefined && body.clientSiteId !== user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  if (user.role !== 'superadmin' && body.email !== undefined && body.email !== user.email)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

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
