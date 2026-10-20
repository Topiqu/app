export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)

  if (!user || user.role !== 'superadmin')
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { hard } = getQuery(event)
  const forceDelete = hard === 'true'
  const site = await db.clientSite.findUnique({ where: { id }, select: { domain: true } })
  if (!site) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })

  if (forceDelete) {
    await db.$transaction(async (tx) => {
      // Global identities may own content or memberships in other publications.
      await tx.user.updateMany({ where: { clientSiteId: id }, data: { clientSiteId: null } })
      await tx.session.updateMany({ where: { clientSiteId: id }, data: { clientSiteId: null } })
      await tx.clientSite.delete({ where: { id } })
    })
  } else {
    await db.$transaction(async (tx) => {
      await tx.clientSite.update({ where: { id }, data: { deletedAt: new Date() } })
      await tx.session.updateMany({ where: { clientSiteId: id }, data: { clientSiteId: null } })
    })
  }
  await invalidateFeed(id)
  await uncache(tenantHostKey(site.domain), domainRedirectKey(site.domain))
  await logAction({
    action: 'CLIENT_DELETE',
    userId: user.id,
    clientSiteId: forceDelete ? null : id,
    ip: getIp(event),
    metadata: { clientSiteId: id, hard: forceDelete },
  })

  return { success: true }
})
