export const signInSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(4).max(124),
})
export type SignInInput = typeof signInSchema._type
