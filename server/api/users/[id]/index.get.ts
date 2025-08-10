export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })

  const { id } = getRouterParams(event)
  if (user.id !== id && user.role !== 'superadmin')
    throw createError({ statusCode: 403, message: 'Nepovolený přístup' })

  const db = await getEnhancedPrisma(user)
  const userData = await db.user.findUnique({
    where: { id },
  })

  if (!userData) throw createError({ statusCode: 404, message: 'Uživatel nenalezen' })

  return {
    id: userData.id,
    username: userData.username,
    email: userData.email,
    bio: userData.bio,
    avatarUrl: userData.avatarUrl,
    createdAt: userData.createdAt.toISOString(),
    lastLogin: userData.lastLogin ? userData.lastLogin.toISOString() : null,
    allowNotifs: userData.allowNotifs,
    role: userData.role,
    emailVerified: userData.emailVerified,
    theme: userData.theme,
  }
})
