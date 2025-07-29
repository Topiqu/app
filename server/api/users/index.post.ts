import argon from 'argon2'

export default defineEventHandler(async (event) => {
  const session = (await getServerSession(event))?.user
  if (!session || session.role !== 'superadmin') throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const body = await readBody(event)
  const { username, email, password, role, clientSiteId } = body

  if (!username || !email || !password || !role || !clientSiteId)
    throw createError({ statusCode: 400, message: 'Chybí povinná pole' })

  const [existingUser, existingClientSite] = await Promise.all([
    prisma.user.findFirst({
      where: { OR: [{ email }, { username }], deletedAt: null },
    }),
    prisma.clientSite.findUnique({ where: { id: clientSiteId } }),
  ])

  if (existingUser)
    throw createError({
      statusCode: 409,
      message: 'Uživatel s tímto emailem nebo jménem již existuje',
    })

  if (!existingClientSite) throw createError({ statusCode: 404, message: 'Klient nenalezen' })

  const hashedPassword = await argon.hash(password)

  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      role,
      clientSiteId,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      clientSiteId: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
    },
  })

  return newUser
})
