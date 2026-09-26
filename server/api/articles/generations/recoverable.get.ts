export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  return prisma.articleGenerationSession.findFirst({
    where: {
      userId: user.id,
      clientSiteId: user.clientSiteId!,
      usefulResultAt: { not: null },
      restoredAt: null,
      dismissedAt: null,
      status: { in: ['COMPLETED', 'INTERRUPTED', 'FAILED', 'FINALIZING', 'WRITING'] },
    },
    orderBy: { lastCheckpointAt: 'desc' },
    select: {
      id: true,
      status: true,
      recoverableSnapshot: true,
      lastCheckpointAt: true,
      charged: true,
      failureReason: true,
    },
  })
})
