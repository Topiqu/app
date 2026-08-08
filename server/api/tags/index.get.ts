export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  // The pickers only ever render id + name; the full row also shipped slug, clientSiteId and
  // three timestamps per tag to every editor load.
  return await prisma.tag.findMany({
    where: {
      clientSiteId: user.clientSiteId,
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
})
