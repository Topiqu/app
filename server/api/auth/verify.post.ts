import { z } from 'zod'
import { emailVerificationCodeSchema, emailVerificationEmailSchema } from '~~/shared/utils/auth'
import { allowEmailVerificationRequest, consumeEmailVerification } from '~~/server/utils/emailVerification'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { email, code } = await readValidatedBody(
    event,
    z.object({ email: emailVerificationEmailSchema, code: emailVerificationCodeSchema }).parse,
  )
  if (!(await allowEmailVerificationRequest(event, email, 'verify')))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  if (!(await consumeEmailVerification(email, code)))
    throw createError({
      statusCode: 400,
      message: t('common.errors.invalidRequest')!,
    })

  return { success: true }
})
