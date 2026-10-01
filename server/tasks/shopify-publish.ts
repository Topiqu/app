import { publishShopifyArticle } from '../utils/shopify/publication'

export default defineMonitoredTask({
  meta: { name: 'shopify-publish', description: 'Retries queued Shopify article publications' },
  async run() {
    await prisma.shopifyPublication.updateMany({
      where: { status: 'PUBLISHING', leaseUntil: { lt: new Date() } },
      data: {
        status: 'UNCERTAIN',
        lease: null,
        leaseUntil: null,
        lastError: 'Publication interrupted; verify and retry',
      },
    })
    const pending = await prisma.shopifyPublication.findMany({
      where: { status: 'QUEUED', nextAttemptAt: { lte: new Date() }, connection: { status: 'CONNECTED' } },
      select: { id: true },
      orderBy: { nextAttemptAt: 'asc' },
      take: 20,
    })
    for (const publication of pending) await publishShopifyArticle(publication.id)
    // An unlinked installation is useless once its refresh token expires; App Home re-creates it.
    await prisma.shopifyInstallation.deleteMany({ where: { refreshTokenExpiresAt: { lt: new Date() } } })
    return { result: { count: pending.length } }
  },
})
