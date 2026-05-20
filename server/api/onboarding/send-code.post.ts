import { randomInt } from 'crypto'
import { issueChallenge } from '~~/server/utils/onboardingTokens'

const schema = z.object({
  email: z.email(),
  language: z.enum(['cs', 'en']).optional(),
})

export default defineEventHandler(async (event) => {
  const { email, language } = await readValidatedBody(event, schema.parse)
  const { translate: t } = await useServerI18n(event)

  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } })
  if (existing) {
    throw createError({
      statusCode: 400,
      message: t('common.errors.alreadyExists') || 'Email already registered',
    })
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const challenge = issueChallenge(email, code)

  await sendEmail({
    event,
    to: email,
    lang: language as Language | undefined,
    template: 'verificationCode',
    data: { verificationCode: code },
  })

  return { challenge }
})
