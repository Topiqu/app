import type { TaskStatus } from '../utils/operations'

export interface OperationsTask {
  name: string
  intervalMinutes: number
  status: TaskStatus
  startedAt: string | null
  finishedAt: string | null
  lastSucceededAt: string | null
  lastFailedAt: string | null
  durationMs: number | null
  failureCode: string | null
  processed: number | null
  failed: number | null
  skipped: number | null
  overdue: boolean
}

export interface OperationsWebhook {
  id: string
  siteName: string
  event: string
  status: 'FAILED' | 'PENDING'
  attempts: number
  nextAttemptAt: string
  statusCode: number | null
  reason: string
  canRetry: boolean
}

export interface OperationsOverview {
  checkedAt: string
  cache: 'ready' | 'unavailable' | 'unconfigured'
  tasks: OperationsTask[]
  queues: {
    scheduledGeneration: number
    activeGeneration: number
    interruptedGeneration: number
    pendingTranslations: number
    activeTranslations: number
    failedTranslations: number
    pendingWebhooks: number
    failedWebhooks: number
  }
  webhooks: { total: number; items: OperationsWebhook[] }
  domains: {
    total: number
    items: { id: string; siteName: string; host: string; state: string; reason: string; checkedAt: string | null }[]
  }
}
