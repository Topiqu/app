import { consumeChallenge, issueVerifiedToken } from '~~/server/utils/onboardingTokens'

const schema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
  challenge: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const { email, code, challenge } = await readValidatedBody(event, schema.parse)
  const { translate: t } = await useServerI18n(event)

  const result = consumeChallenge(challenge, email, code)
  if (!result.ok) {
    const messageKey =
      result.reason === 'expired'
        ? 'common.auth.codeExpired'
        : result.reason === 'mismatch'
          ? 'common.auth.codeMismatch'
          : 'common.errors.invalidRequest'
    throw createError({
      statusCode: 400,
      message: t(messageKey) || 'Invalid or expired code',
      data: { reason: result.reason },
    })
  }

  return { verifiedToken: issueVerifiedToken(email) }
})
