import { withDomainLease } from '../../utils/domains/connections'

export default defineEventHandler(async (event) => {
  const { user, db, clientSiteId } = await requireDomainAccess(event)
  const site = await db.clientSite.findUniqueOrThrow({
    where: { id: clientSiteId },
    select: { pendingDomain: true, pendingDomainToken: true },
  })
  const connection = site.pendingDomain
    ? await db.domainConnection.findUnique({ where: { host: site.pendingDomain }, select: { id: true } })
    : null
  const cancel = async () =>
    prisma.$transaction(async (tx) => {
      const changed = await tx.clientSite.updateMany({
        where: { id: clientSiteId, pendingDomain: site.pendingDomain, pendingDomainToken: site.pendingDomainToken },
        data: { pendingDomain: null, pendingDomainToken: null, pendingDomainRequestedAt: null },
      })
      if (!changed.count) throw createError({ statusCode: 409, message: 'Domain setup changed' })
      if (connection)
        await tx.domainConnection.update({
          where: { id: connection.id },
          data: { cleanupRequestedAt: new Date(), state: 'DISCONNECTING' },
        })
    })
  if (connection) await withDomainLease(connection.id, cancel)
  else await cancel()
  await logAction({ action: 'DOMAIN_SWITCH_CANCELLED', userId: user.id, clientSiteId, ip: getIp(event) })
  return { success: true }
})
