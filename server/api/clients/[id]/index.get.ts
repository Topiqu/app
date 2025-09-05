export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    throw createError({ statusCode: 401, message: 'Neautorizováno' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID nenalezeno' })
  }

  const clientSite = await prisma.clientSite.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: 'ai' },
        select: { id: true, username: true, bio: true, avatarUrl: true },
      },
      socials: true,
    },
  })

  if (!clientSite) {
    throw createError({ statusCode: 404, message: 'Klient nenalezen' })
  }

  return {
    ...clientSite,
    aiUser: clientSite.users[0]
      ? {
          username: clientSite.users[0].username,
          bio: clientSite.users[0].bio,
          avatarUrl: clientSite.users[0].avatarUrl,
        }
      : null,
  }
})
