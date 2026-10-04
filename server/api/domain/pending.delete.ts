export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireDomainAccess(event)
  await db.clientSite.update({
    where: { id: clientSiteId },
    data: { pendingDomain: null, pendingDomainToken: null, pendingDomainRequestedAt: null },
  })
  await logAction({ action: 'DOMAIN_SWITCH_CANCELLED', userId: user.id, clientSiteId, ip: getIp(event) })
  return { success: true }
})
