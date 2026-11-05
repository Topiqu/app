import { z } from 'zod'

const bodySchema = z.object({ token: z.string().min(1).max(2048) })

// Authorized by the signed link alone. The dialog already checked the typed email and blog domains.
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  if (!(await consumeRateLimit(`account-deletion-link:${ipKey(event)}`, 20, 900)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  const { token } = await readValidatedBody(event, bodySchema.parse)
  const claims = readDeletionConfirmToken(token)
  if (!claims) throw createError({ statusCode: 400, message: t('common.accountDeletion.invalid')! })

  const blogs = await closingBlogs(claims.userId)
  if (hasContractedBlog(blogs) || !sameLiveBlogs(blogs, claims.siteIds))
    throw createError({ statusCode: 409, message: t('common.accountDeletion.blogsChanged')! })

  if (await hasScheduledBillingChange(blogs))
    throw createError({ statusCode: 409, message: t('profile.deleteAccount.errors.billingChange')! })

  const { scheduledFor } = await scheduleAccountDeletion(claims.userId, claims.siteIds, event)
  return { scheduledFor: scheduledFor.toISOString() }
})
