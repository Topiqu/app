import { randomBytes } from 'node:crypto'

export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const body = await readBody<{ email?: string }>(event)
  const email = body.email?.trim().toLowerCase()
  if (!email?.endsWith('@test.local')) throw createError({ statusCode: 400, statusMessage: 'Invalid dev user' })

  const token = randomBytes(32).toString('hex')
  const result = await prisma.user.updateMany({
    where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    data: {
      onboardingLoginToken: token,
      onboardingLoginTokenExpiresAt: new Date(Date.now() + 60_000),
    },
  })
  if (!result.count) throw createError({ statusCode: 404, statusMessage: 'Dev user not found' })

  return { token }
})
