import argon from 'argon2'
import { signInSchema } from '../../../utils/auth'
export default defineEventHandler(async (event) => {
  // const user = (await getServerSession(event))?.user
  // if (!user)
  //   throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })
  const body = await readBody(event)
  const { username, password } = signInSchema.parse(body)

  const exists = await prisma.user.findFirst({ where: { username } })
  if (exists) throw createError({ statusCode: 400, message: 'Username taken' })

  const hash = await argon.hash(password)
  return await prisma.user.create({
    data: { username, password: hash, email: body.email },
    select: { id: true, username: true },
  })
})
