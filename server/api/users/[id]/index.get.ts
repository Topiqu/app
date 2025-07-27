export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  if (user.id !== id)
    throw createError({ statusCode: 403, statusMessage: 'Nepovolený přístup' })

  return await prisma.user.findUnique({
    where: { id },
    select: { username: true, bio: true, email: true, role: true },
  })
})
