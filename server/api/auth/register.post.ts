import { z } from 'zod'
import { emailVerificationEmailSchema, signInSchema } from '~~/shared/utils/auth'
import { allowEmailVerificationRequest, issueEmailVerification } from '~~/server/utils/emailVerification'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const body = await readValidatedBody(
    event,
    signInSchema.extend({ username: z.string().trim().min(3).max(50), email: emailVerificationEmailSchema }).parse,
  )
  const { username, email, password } = body

  if (!(await allowEmailVerificationRequest(event, email, 'issue')))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  const exists = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: { equals: email, mode: 'insensitive' } }] },
    select: { id: true },
  })
  if (exists)
    throw createError({
      statusCode: 400,
      message: t('common.errors.alreadyExists')!,
    })

  const user = await saveUserWithLogging(event, {
    username,
    email,
    password,
    role: 'reader',
    emailVerified: false,
  })

  await issueEmailVerification(event, email, user.id)

  return user
})
