import { z } from 'zod'

const bodySchema = z.object({ token: z.string().min(1).max(2048) })

// Authorized by the signed link alone, so it works while the account has no sessions.
export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  if (!(await consumeRateLimit(`account-deletion-link:${ipKey(event)}`, 20, 900)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  const { token } = await readValidatedBody(event, bodySchema.parse)
  const claims = readDeletionRestoreToken(token)
  const result = claims && (await restoreAccount(claims, event))
  if (!result) throw createError({ statusCode: 400, message: t('common.accountDeletion.invalid')! })
  return { billing: result.billing }
})
