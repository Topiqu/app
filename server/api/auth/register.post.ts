import argon from 'argon2'
import { signInSchema } from '../../../utils/auth'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = signInSchema.parse(body)

  const exists = await prisma.user.findFirst({ where: { username } })
  if (exists) throw createError({ statusCode: 400, message: 'Username taken' })

  const hash = await argon.hash(password)
  const user = await prisma.user.create({
    data: { username, password: hash },
    select: { id: true, username: true },
  })

  return user
})
