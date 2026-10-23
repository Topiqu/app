import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { email } = await readValidatedBody(event, z.object({ email: emailVerificationEmailSchema }).parse)
  if (await allowEmailVerificationRequest(event, email, 'issue')) await issueEmailVerification(event, email)
  return { success: true, message: t('common.auth.verificationRequested')! }
})
