export default defineMonitoredTask({
  meta: { name: 'domain-cleanup', description: 'Retry provider cleanup after custom-domain retirement' },
  async run() {
    const deadline = Date.now() + 20000
    const connections = await prisma.domainConnection.findMany({
      where: { cleanupRequestedAt: { not: null }, state: { not: 'DISCONNECTED' } },
      select: { id: true, clientSiteId: true },
      orderBy: [{ checkedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
      take: 10,
    })
    let attempted = 0
    let processed = 0
    let failed = 0
    for (const connection of connections) {
      if (Date.now() >= deadline) break
      const result = await attemptDomainCleanup(connection.id, connection.clientSiteId)
      if (result?.state === 'DISCONNECTED') processed++
      else if (result) failed++
      attempted++
    }
    return { result: { attempted, processed, failed } }
  },
})
