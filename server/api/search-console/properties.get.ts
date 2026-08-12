import { decryptSearchConsoleToken } from '../../utils/searchConsole/crypto'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { clientSiteId: user.clientSiteId! } })
  if (!connection) throw createError({ statusCode: 404, message: 'Search Console is not connected' })
  const accessToken = await refreshSearchConsoleAccess(decryptSearchConsoleToken(connection.encryptedRefreshToken))
  return listSearchConsoleSites(accessToken)
})
