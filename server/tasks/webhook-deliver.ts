const RETENTION_DAYS = 30

export default defineMonitoredTask({
  meta: {
    name: 'webhook-deliver',
    description: 'Send due webhook deliveries with retries and prune finished ones after 30 days',
  },
  async run() {
    const result = await deliverDueWebhooks()
    const pruned = await prisma.webhookDelivery.deleteMany({
      where: {
        status: { in: ['SUCCEEDED', 'FAILED'] },
        createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) },
      },
    })
    return { result: { ...result, pruned: pruned.count } }
  },
})
