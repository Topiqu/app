export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await requireUser(event, { minRole: 'admin' })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  if (user.role !== 'superadmin' && id !== user.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

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
      linkedinCompanies: {
        include: { brandProfile: true },
      },
    },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  const activeFeatures = clientSite.features.map((cf) => cf.feature.code)

  const allowedFeatures = getAllowedFeatures(clientSite.plan)

  return {
    ...clientSite,
    aiUser: clientSite.users[0]
      ? {
          username: clientSite.users[0].username,
          bio: clientSite.users[0].bio,
          avatarUrl: clientSite.users[0].avatarUrl,
        }
      : null,
    linkedinCompanies: clientSite.linkedinCompanies,
    activeFeatures,
    allowedFeatures,
  }
})
