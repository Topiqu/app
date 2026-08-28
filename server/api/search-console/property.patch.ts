import { z } from 'zod'

import { decryptSearchConsoleToken } from '../../utils/searchConsole/crypto'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', user.clientSiteId)
  if (!(await hasActiveFeature(prisma, user.clientSiteId!, 'SEARCH_CONSOLE')))
    throw createError({ statusCode: 403, message: 'Search Console intelligence requires PREMIUM' })
  const body = z.object({ propertyUrl: z.string().min(1).max(2048) }).parse(await readBody(event))
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { clientSiteId: user.clientSiteId! } })
  if (!connection) throw createError({ statusCode: 404, message: 'Search Console is not connected' })
  const accessToken = await refreshSearchConsoleAccess(decryptSearchConsoleToken(connection.encryptedRefreshToken))
  const property = (await listSearchConsoleSites(accessToken)).find((item) => item.siteUrl === body.propertyUrl)
  if (!property) throw createError({ statusCode: 403, message: 'The Google account cannot access this property' })
  await prisma.searchConsoleConnection.update({
    where: { clientSiteId: user.clientSiteId! },
    data: { propertyUrl: property.siteUrl, permissionLevel: property.permissionLevel },
  })
  return { propertyUrl: property.siteUrl, permissionLevel: property.permissionLevel }
})
