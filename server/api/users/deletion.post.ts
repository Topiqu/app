import { z } from 'zod'
import argon from 'argon2'

const bodySchema = z.object({
  email: z.string().max(255),
  blogs: z.record(z.string(), z.string().max(255)).default({}),
  password: z.string().max(200).optional(),
  totp: z.string().max(16).optional(),
})

// Every check is here rather than in the dialog: the session alone must never be enough to delete an account.
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const sessionUser = await getSessionUser(event)
  if (!sessionUser) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  if (!(await consumeRateLimit(`account-deletion:${sessionUser.id}`, 8, 900)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  const body = await readValidatedBody(event, (input) => {
    const parsed = bodySchema.safeParse(input)
    if (!parsed.success) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
    return parsed.data
  })

  const user = await prisma.user.findFirst({
    where: { id: sessionUser.id, deletedAt: null },
    select: { id: true, email: true, username: true, language: true, role: true, password: true, totpSecret: true },
  })
  if (!user) throw createError({ statusCode: 404, message: t('common.errors.userNotFound')! })
  // The stored role: on a custom domain the session role is scoped to that tenant.
  if (user.role === 'superadmin') throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  if (body.email.trim().toLowerCase() !== user.email.toLowerCase())
    throw createError({ statusCode: 400, message: t('profile.deleteAccount.errors.email')! })

  const blogs = await closingBlogs(user.id)
  if (hasContractedBlog(blogs))
    throw createError({ statusCode: 409, message: t('profile.deleteAccount.errors.contracted')! })
  if (!blogConfirmationsMatch(blogs, body.blogs))
    throw createError({ statusCode: 400, message: t('profile.deleteAccount.errors.blogs')! })
  if (await hasScheduledBillingChange(blogs))
    throw createError({ statusCode: 409, message: t('profile.deleteAccount.errors.billingChange')! })

  if (user.totpSecret) {
    const result = await checkTotpCode(user.id, user.totpSecret, body.totp)
    if (result === 'limited') throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
    if (result !== 'ok') throw createError({ statusCode: 400, message: t('profile.deleteAccount.errors.totp')! })
  }

  if (!user.password) {
    // No password to prove identity with, so the inbox does it.
    await sendDeletionConfirmEmail(user, liveBlogIds(blogs), event)
    return { status: 'confirmation_sent' as const }
  }

  if (!body.password || !(await argon.verify(user.password, body.password)))
    throw createError({ statusCode: 400, message: t('profile.deleteAccount.errors.password')! })

  const { scheduledFor } = await scheduleAccountDeletion(user.id, liveBlogIds(blogs), event)
  return { status: 'scheduled' as const, scheduledFor: scheduledFor.toISOString() }
})
