import type { OperationsOverview, OperationsTask } from '~~/shared/types/operations'

import {
  domainFailureReason,
  monitoredTaskIntervals,
  taskIsOverdue,
  webhookFailureReason,
} from '~~/shared/utils/operations'

export default defineEventHandler(async (event): Promise<OperationsOverview> => {
  const { db } = await requireDb(event, { role: 'superadmin' })
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const now = new Date()
  const webhookIssues = {
    deletedAt: null,
    clientSite: { deletedAt: null },
    OR: [{ status: 'FAILED' as const }, { status: 'PENDING' as const, attempts: { gt: 0 } }],
  }
  const domainIssues = {
    deletedAt: null,
    clientSite: { deletedAt: null },
    state: { not: 'DISCONNECTED' as const },
    OR: [
      { state: { not: 'READY' as const } },
      { errorCode: { not: null } },
      { certificateMode: 'CUSTOM' as const, certificateExpiresAt: { lte: new Date(now.getTime() + 14 * 86_400_000) } },
    ],
  }

  const [
    cache,
    taskRows,
    scheduledGeneration,
    activeGeneration,
    interruptedGeneration,
    pendingTranslations,
    activeTranslations,
    failedTranslations,
    pendingWebhooks,
    failedWebhooks,
    webhookTotal,
    webhooks,
    domainTotal,
    domains,
  ] = await Promise.all([
    cacheAvailability(),
    db.systemTaskStatus.findMany({
      select: {
        name: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        lastSucceededAt: true,
        lastFailedAt: true,
        durationMs: true,
        failureCode: true,
        processed: true,
        failed: true,
        skipped: true,
      },
    }),
    db.clientSite.count({
      where: {
        deletedAt: null,
        generationFrequency: { not: 'NONE' },
        ...activeFeatureFilter('ARTICLE_CRONS'),
        OR: [{ nextReleaseAt: null }, { nextReleaseAt: { lte: new Date(now.getTime() + GENERATION_LEAD_MS) } }],
      },
    }),
    // Recovery receipts deliberately deny generic model access. Only system-wide counts leave this superadmin boundary.
    prisma.articleGenerationSession.count({
      where: {
        deletedAt: null,
        clientSite: { deletedAt: null },
        status: { in: ['RESERVED', 'RESEARCHING', 'WRITING', 'FINALIZING'] },
      },
    }),
    prisma.articleGenerationSession.count({
      where: { deletedAt: null, clientSite: { deletedAt: null }, status: { in: ['INTERRUPTED', 'FAILED'] } },
    }),
    db.articleTranslation.count({
      where: { deletedAt: null, clientSite: { deletedAt: null }, status: { in: ['PENDING', 'STALE'] } },
    }),
    db.articleTranslation.count({ where: { deletedAt: null, clientSite: { deletedAt: null }, status: 'TRANSLATING' } }),
    db.articleTranslation.count({ where: { deletedAt: null, clientSite: { deletedAt: null }, status: 'FAILED' } }),
    db.webhookDelivery.count({ where: { deletedAt: null, clientSite: { deletedAt: null }, status: 'PENDING' } }),
    db.webhookDelivery.count({ where: { deletedAt: null, clientSite: { deletedAt: null }, status: 'FAILED' } }),
    db.webhookDelivery.count({ where: webhookIssues }),
    db.webhookDelivery.findMany({
      where: webhookIssues,
      take: 20,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        event: true,
        status: true,
        attempts: true,
        nextAttemptAt: true,
        lastStatusCode: true,
        clientSite: { select: { name: true, plan: true } },
        webhook: { select: { active: true, deletedAt: true } },
      },
    }),
    db.domainConnection.count({ where: domainIssues }),
    db.domainConnection.findMany({
      where: domainIssues,
      take: 20,
      orderBy: { checkedAt: { sort: 'asc', nulls: 'first' } },
      select: {
        id: true,
        host: true,
        state: true,
        errorCode: true,
        checkedAt: true,
        certificateExpiresAt: true,
        clientSite: { select: { name: true } },
      },
    }),
  ])

  const statuses = new Set(['unknown', 'running', 'succeeded', 'degraded', 'failed'])
  const tasks: OperationsTask[] = Object.entries(monitoredTaskIntervals).map(([name, intervalMinutes]) => {
    const row = taskRows.find((task) => task.name === name)
    const lastSucceededAt = row?.lastSucceededAt?.toISOString() ?? null
    return {
      name,
      intervalMinutes,
      status: row && statuses.has(row.status) ? (row.status as OperationsTask['status']) : 'unknown',
      startedAt: row?.startedAt?.toISOString() ?? null,
      finishedAt: row?.finishedAt?.toISOString() ?? null,
      lastSucceededAt,
      lastFailedAt: row?.lastFailedAt?.toISOString() ?? null,
      durationMs: row?.durationMs ?? null,
      failureCode: row?.failureCode === 'ITEM_FAILURES' ? 'ITEM_FAILURES' : row?.failureCode ? 'TASK_FAILED' : null,
      processed: row?.processed ?? null,
      failed: row?.failed ?? null,
      skipped: row?.skipped ?? null,
      overdue: taskIsOverdue(lastSucceededAt, intervalMinutes, now.getTime()),
    }
  })

  return {
    checkedAt: now.toISOString(),
    cache,
    tasks,
    queues: {
      scheduledGeneration,
      activeGeneration,
      interruptedGeneration,
      pendingTranslations,
      activeTranslations,
      failedTranslations,
      pendingWebhooks,
      failedWebhooks,
    },
    webhooks: {
      total: webhookTotal,
      items: webhooks.map((row) => {
        const active = row.webhook.active && !row.webhook.deletedAt && row.clientSite.plan !== 'BASIC'
        return {
          id: row.id,
          siteName: row.clientSite.name,
          event: row.event,
          status: row.status === 'FAILED' ? 'FAILED' : 'PENDING',
          attempts: row.attempts,
          nextAttemptAt: row.nextAttemptAt.toISOString(),
          statusCode: row.lastStatusCode,
          reason: webhookFailureReason(row.lastStatusCode, active),
          canRetry: row.status === 'FAILED' && active,
        }
      }),
    },
    domains: {
      total: domainTotal,
      items: domains.map((row) => ({
        id: row.id,
        siteName: row.clientSite.name,
        host: row.host,
        state: row.state,
        checkedAt: row.checkedAt?.toISOString() ?? null,
        reason:
          row.state === 'READY' && row.certificateExpiresAt
            ? 'domainCertificate'
            : domainFailureReason(row.errorCode, row.state),
      })),
    },
  }
})
