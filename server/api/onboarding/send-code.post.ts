import { randomInt } from 'crypto'
import { issueChallenge } from '~~/server/utils/onboardingTokens'

const schema = z.object({
  email: z.email(),
  language: z.enum(['cs', 'en']).optional(),
  website: z.string().optional(),
  turnstileToken: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const { email, website, turnstileToken } = await readValidatedBody(event, schema.parse)
  const { translate: t } = await useServerI18n(event)

  if (website && website.trim() !== '') {
    return { challenge: 'ok' }
  }

  if (!(await verifyTurnstile(event, turnstileToken))) {
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest') || 'Verification failed' })
  }

  if (isDisposableEmail(email)) {
    throw createError({
      statusCode: 400,
      message: t('common.auth.disposableEmail') || 'Disposable email addresses are not allowed',
    })
  }

  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } })
  if (existing) {
    throw createError({
      statusCode: 400,
      message: t('common.errors.alreadyExists') || 'Email already registered',
    })
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const challenge = issueChallenge(email, code)

  const userName = email.split('@')[0] ?? ''

  await sendEmail({
    event,
    to: email,
    template: 'verificationCode',
    data: { verificationCode: code, userName, actionType: '{t:verificationCode.actions.signup}' },
  })

  return { challenge }
})
