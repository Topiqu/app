export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)
  if (!user || user.role !== 'superadmin') throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const body = await readBody(event)
  const { username, email, password, role, clientSiteId } = body

  if (!username || !email || !password || !role || !clientSiteId) {
    throw createError({ statusCode: 400, message: 'Chybí povinná pole' })
  }

  const [existingUser, existingClientSite] = await Promise.all([
    db.user.findFirst({
      where: { OR: [{ email }, { username }], deletedAt: null },
    }),
    db.clientSite.findUnique({ where: { id: clientSiteId } }),
  ])

  if (existingUser) {
    throw createError({
      statusCode: 409,
      message: 'Uživatel s tímto emailem nebo jménem již existuje',
    })
  }

  if (!existingClientSite) throw createError({ statusCode: 404, message: 'Klient nenalezen' })

  const newUser = await saveUserWithLogging(event, {
    username,
    email,
    password,
    role,
    clientSiteId,
  })

  return newUser
})
