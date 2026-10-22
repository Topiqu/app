import { publishShopifyArticle } from '../utils/shopify/publication'

export default defineMonitoredTask({
  meta: { name: 'shopify-publish', description: 'Retries queued Shopify article publications' },
  async run() {
    const interrupted = await prisma.shopifyPublication.updateMany({
      where: { status: 'PUBLISHING', leaseUntil: { lt: new Date() } },
      data: {
        status: 'UNCERTAIN',
        lease: null,
        leaseUntil: null,
        lastError: 'Publication interrupted; verify and retry',
      },
    })
    const pending = await prisma.shopifyPublication.findMany({
      where: {
        status: 'QUEUED',
        nextAttemptAt: { lte: new Date() },
        connection: { status: 'CONNECTED' },
        clientSite: { publishToShopify: true },
      },
      select: { id: true },
      orderBy: { nextAttemptAt: 'asc' },
      take: 20,
    })
    let processed = 0
    let failed = interrupted.count
    let uncertain = interrupted.count
    let skipped = 0
    let retrying = 0
    for (const publication of pending) {
      const status = await publishShopifyArticle(publication.id)
      if (status === 'SYNCED') processed++
      else if (status === 'SKIPPED') skipped++
      else {
        failed++
        if (status === 'UNCERTAIN') uncertain++
        if (status === 'QUEUED') retrying++
      }
    }
    // An unlinked installation is useless once its refresh token expires; App Home re-creates it.
    await prisma.shopifyInstallation.deleteMany({ where: { refreshTokenExpiresAt: { lt: new Date() } } })
    return { result: { count: pending.length, processed, failed, skipped, uncertain, retrying } }
  },
})
