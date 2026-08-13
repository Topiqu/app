import { format, subDays } from 'date-fns'

import { decryptSearchConsoleToken } from '../utils/searchConsole/crypto'

export default defineTask({
  meta: { name: 'search-console-sync', description: 'Sync finalized Search Console performance for PREMIUM tenants' },
  async run() {
    const connections = await prisma.searchConsoleConnection.findMany({
      where: {
        status: { in: ['CONNECTED', 'ERROR'] },
        propertyUrl: { not: null },
        clientSite: { plan: { in: ['PREMIUM', 'CUSTOM'] } },
      },
    })
    let synced = 0
    for (const connection of connections) {
      try {
        const accessToken = await refreshSearchConsoleAccess(
          decryptSearchConsoleToken(connection.encryptedRefreshToken),
        )
        const end = subDays(new Date(), 2)
        const start = subDays(end, 2)
        const rows = await querySearchConsole(
          accessToken,
          connection.propertyUrl!,
          format(start, 'yyyy-MM-dd'),
          format(end, 'yyyy-MM-dd'),
        )
        for (const row of rows) {
          const [date, page, query = ''] = row.keys
          if (!date || !page) continue
          await prisma.searchConsoleMetric.upsert({
            where: {
              clientSiteId_date_page_query_country_device: {
                clientSiteId: connection.clientSiteId,
                date: new Date(`${date}T00:00:00.000Z`),
                page,
                query,
                country: '',
                device: '',
              },
            },
            create: {
              clientSiteId: connection.clientSiteId,
              propertyUrl: connection.propertyUrl!,
              date: new Date(`${date}T00:00:00.000Z`),
              page,
              query,
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            },
            update: { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position },
          })
        }
        await prisma.searchConsoleConnection.update({
          where: { id: connection.id },
          data: { status: 'CONNECTED', lastSyncAt: new Date(), lastError: null, lastErrorAt: null },
        })
        synced++
      } catch (error) {
        await prisma.searchConsoleConnection.update({
          where: { id: connection.id },
          data: {
            status: 'ERROR',
            lastErrorAt: new Date(),
            lastError: error instanceof Error ? error.message.slice(0, 500) : 'Unknown sync error',
          },
        })
      }
    }
    return { result: { connections: connections.length, synced } }
  },
})
