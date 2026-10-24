export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)

  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { hard } = getQuery(event)
  const forceDelete = hard === 'true'
  if (user.role !== 'superadmin') {
    const { membership } = await requireTenantMember(event, id)
    if (membership.role !== 'OWNER' || forceDelete)
      throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  }
  const site = await db.clientSite.findUnique({ where: { id }, select: { domain: true } })
  if (!site) throw createError({ statusCode: 404, message: t('common.errors.blogNotFound')! })
  if (user.role !== 'superadmin') {
    const body = await readBody<{ confirmation?: unknown }>(event)
    if (body?.confirmation !== site.domain)
      throw createError({ statusCode: 400, message: t('common.preferences.danger.confirmationRequired')! })
  }

  if (forceDelete) {
    // Preserve provider IDs until cleanup is complete; no cascaded deletion of infrastructure evidence.
    if (
      await db.domainConnection.count({
        where: {
          clientSiteId: id,
          OR: [
            { state: { not: 'DISCONNECTED' } },
            { cloudflareId: { not: null } },
            { dokployId: { not: null } },
            { certificateId: { not: null } },
          ],
        },
      })
    )
      throw createError({ statusCode: 409, message: t('common.domain.provisioning.cleanupRequired')! })
    // Explicit superadmin maintenance: generic policies intentionally cannot delete provisioning rows.
    await prisma.$transaction(async (tx) => {
      await tx.domainConnection.deleteMany({
        where: { clientSiteId: id, state: 'DISCONNECTED', cloudflareId: null, dokployId: null, certificateId: null },
      })
      // Global identities may own content or memberships in other publications.
      await tx.user.updateMany({ where: { clientSiteId: id }, data: { clientSiteId: null } })
      await tx.session.updateMany({ where: { clientSiteId: id }, data: { clientSiteId: null } })
      await tx.clientSite.delete({ where: { id } })
    })
  } else {
    // Owner-authorized tenant maintenance must detach every member's session, not just the owner's.
    await prisma.$transaction(async (tx) => {
      await tx.clientSite.update({ where: { id }, data: { deletedAt: new Date() } })
      await tx.session.updateMany({ where: { clientSiteId: id }, data: { clientSiteId: null } })
    })
  }
  await invalidateFeed(id)
  await uncache(tenantHostKey(site.domain), domainRedirectKey(site.domain))
  try {
    await logAction({
      action: 'CLIENT_DELETE',
      userId: user.id,
      clientSiteId: forceDelete ? null : id,
      ip: getIp(event),
      metadata: { clientSiteId: id, hard: forceDelete },
    })
  } catch (error) {
    await reportCaughtError('Client deletion audit failed', error, { clientSiteId: id })
  }

  return { success: true }
})
