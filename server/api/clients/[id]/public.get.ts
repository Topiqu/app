export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  }

  const clientSite = await prisma.clientSite.findUnique({
    where: { id },
    select: {
      id: true,
      socials: true,
    },
  })

  if (!clientSite) {
    throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })
  }

  return clientSite
})
