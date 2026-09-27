import { createHmac, timingSafeEqual } from 'node:crypto'

// Stateless and non-expiring on purpose: an email link must keep working for as long as the mail sits in an inbox.
const sign = (userId: string) => {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return createHmac('sha256', secret).update(`unsubscribe:${userId}`).digest('base64url')
}

export const unsubscribeUrl = (
  user: { id: string; language: Language },
  origin: string = useRuntimeConfig().public.baseUrl,
) => `${origin}/${user.language}/unsubscribe?u=${encodeURIComponent(user.id)}&t=${sign(user.id)}`

export const isUnsubscribeToken = (userId: string, token: string) => {
  const expected = Buffer.from(sign(userId))
  const given = Buffer.from(token)
  return given.length === expected.length && timingSafeEqual(given, expected)
}
