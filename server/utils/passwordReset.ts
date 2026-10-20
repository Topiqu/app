import { createHmac } from 'node:crypto'

export const passwordResetIdentifier = (userId: string) => `password-reset:${userId}`
export const passwordResetHash = (value: string) => {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is required')
  return createHmac('sha256', secret).update(`password-reset:${value}`).digest('hex')
}
