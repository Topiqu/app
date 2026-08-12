export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  const site = await db.clientSite.findUnique({ where: { id: user.clientSiteId! }, select: { plan: true } })
  const connection = await db.searchConsoleConnection.findUnique({
    where: { clientSiteId: user.clientSiteId! },
    select: { googleEmail: true, propertyUrl: true, permissionLevel: true, status: true, lastSyncAt: true, lastErrorAt: true, lastError: true },
  })
  return { eligible: Boolean(site && ['PREMIUM', 'CUSTOM'].includes(site.plan)), connection }
})
