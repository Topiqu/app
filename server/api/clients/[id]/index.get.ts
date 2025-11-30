export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !['superadmin', 'admin'].includes(user.role))
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const clientSite = await prisma.clientSite.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: 'ai' },
        select: { id: true, username: true, bio: true, avatarUrl: true },
      },
      socials: true,
      features: {
        where: { isActive: true },
        include: {
          feature: {
            select: { code: true },
          },
        },
      },
    },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const activeFeatures = clientSite.features.map((cf) => cf.feature.code)

  const allowedFeatures = {
    AI: ['PRO', 'PREMIUM', 'CUSTOM'].includes(clientSite.plan),
    SENTIMENT: ['PREMIUM', 'CUSTOM'].includes(clientSite.plan),
    ARTICLE_CRONS: ['PRO', 'PREMIUM', 'CUSTOM'].includes(clientSite.plan),
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
    activeFeatures,
    allowedFeatures,
  }
})
