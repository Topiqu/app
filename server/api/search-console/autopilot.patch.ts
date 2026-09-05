import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', user.clientSiteId)

  const { enabled } = z.object({ enabled: z.boolean() }).parse(await readBody(event))
  const clientSiteId = user.clientSiteId!
  const site = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: {
      plan: true,
      features: {
        where: { isActive: true, feature: { code: { in: ['AI', 'SEARCH_CONSOLE'] } } },
        select: { feature: { select: { code: true } } },
      },
    },
  })
  const active = new Set(site?.features.map((row) => row.feature.code) ?? [])
  if (enabled && (!site || !['PREMIUM', 'CUSTOM'].includes(site.plan) || !active.has('SEARCH_CONSOLE')))
    throw createError({
      statusCode: 403,
      message: 'Search Console Autopilot requires an active Search Console feature',
    })
  if (enabled && !active.has('AI'))
    throw createError({ statusCode: 409, message: 'Enable AI before enabling Search Console Autopilot' })

  const connection = await db.searchConsoleConnection.findUnique({
    where: { clientSiteId },
    select: { propertyUrl: true, autopilotEnabled: true },
  })
  if (!connection) throw createError({ statusCode: 404, message: 'Search Console is not connected' })
  if (enabled && !connection.propertyUrl)
    throw createError({ statusCode: 409, message: 'Choose a Search Console property first' })

  if (connection.autopilotEnabled !== enabled) {
    await db.searchConsoleConnection.update({ where: { clientSiteId }, data: { autopilotEnabled: enabled } })
    await logAction({
      action: enabled ? 'SEARCH_CONSOLE_AUTOPILOT_ENABLED' : 'SEARCH_CONSOLE_AUTOPILOT_DISABLED',
      userId: user.id,
      clientSiteId,
      ip: getIp(event),
    })
  }

  return { enabled }
})
