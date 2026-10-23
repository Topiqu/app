import { z } from './zod'

export const EMAIL_VERIFICATION_CODE_LENGTH = 8
export const EMAIL_VERIFICATION_COOLDOWN_MS = 60_000
export const emailVerificationEmailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((value) => value.toLowerCase())
export const emailVerificationCodeSchema = z
  .string()
  .trim()
  .length(EMAIL_VERIFICATION_CODE_LENGTH)
  .regex(/^[a-f0-9]+$/i)
  .transform((value) => value.toLowerCase())

export const signInSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(4).max(124),
  email: z.email(),
})
export type SignInInput = typeof signInSchema.type
