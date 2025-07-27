export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  if (user.id !== id)
    throw createError({ statusCode: 403, statusMessage: 'Nepovolený přístup' })

  const body = await readValidatedBody(event, UserUpdateScalarSchema.parse)
  return await prisma.user.update({
    where: { id },
    data: { username: body.username, bio: body.bio },
    select: { username: true, bio: true },
  })
})
