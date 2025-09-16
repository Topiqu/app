export const signInSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  password: z.string().min(4).max(124),
  email: z.string().email(),
})
export type SignInInput = typeof signInSchema.type
