import { z } from 'zod'
import { emailVerificationEmailSchema } from '~~/shared/utils/auth'
import { allowEmailVerificationRequest, issueEmailVerification } from '~~/server/utils/emailVerification'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { email } = await readValidatedBody(event, z.object({ email: emailVerificationEmailSchema }).parse)
  if (await allowEmailVerificationRequest(event, email, 'issue')) await issueEmailVerification(event, email)
  return { success: true, message: t('common.auth.verificationRequested')! }
})
