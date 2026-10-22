import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { withHeartbeat } from '../../server/utils/monitoring'

type Row = Record<string, unknown>
let row: Row | null
const log = { info: vi.fn(), error: vi.fn() }
const upsert = vi.fn()
const updateMany = vi.fn()
const fetch = vi.hoisted(() => vi.fn())
mockNuxtImport('$fetch', () => fetch)

const matches = (condition: Row): boolean => {
  if (!row) return false
  for (const [key, value] of Object.entries(condition)) {
    if (key === 'OR') {
      if (!(value as Row[]).some(matches)) return false
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      const compare = value as { lt?: Date; lte?: Date }
      const current = row[key] as Date | null
      if (!current || (compare.lt && current >= compare.lt) || (compare.lte && current > compare.lte)) return false
    } else if (row[key] !== value) return false
  }
  return true
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-22T10:00:00Z'))
  vi.clearAllMocks()
  row = null
  log.info.mockResolvedValue(undefined)
  log.error.mockResolvedValue(undefined)
  fetch.mockResolvedValue(undefined)
  upsert.mockImplementation(async ({ create }: { create: Row }) => {
    row ??= { ...create, startedAt: null, lastSucceededAt: null, lastFailedAt: null }
    return row
  })
  updateMany.mockImplementation(async ({ where, data }: { where: Row; data: Row }) => {
    if (!matches(where)) return { count: 0 }
    row = { ...row, ...data }
    return { count: 1 }
  })
  vi.stubGlobal('prisma', { systemTaskStatus: { upsert, updateMany } })
  vi.stubGlobal('logger', log)
  vi.stubGlobal('$fetch', fetch)
  vi.stubEnv('BETTERSTACK_HEARTBEAT_TRANSLATE_PENDING', 'https://heartbeat.invalid/fixture')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('durable task monitoring', () => {
  it('records a clean completion while logging only bounded counters', async () => {
    const result = { result: { processed: 2, failed: 0, skipped: 1, customerContent: 'private' } }
    await expect(withHeartbeat('translate-pending', async () => result)).resolves.toBe(result)
    expect(row).toMatchObject({
      status: 'succeeded',
      processed: 2,
      failed: 0,
      skipped: 1,
      failureCode: null,
      lastSucceededAt: new Date('2026-10-22T10:00:00Z'),
    })
    expect(JSON.stringify(log.info.mock.calls)).not.toContain('private')
    expect(fetch).toHaveBeenCalledWith('https://heartbeat.invalid/fixture', expect.anything())
  })

  it('marks reported item failures as degraded without discarding the task result', async () => {
    const result = { result: { failed: [{ error: 'secret upstream error' }] } }
    await expect(withHeartbeat('translate-pending', async () => result)).resolves.toBe(result)
    expect(row).toMatchObject({ status: 'degraded', failed: 1, failureCode: 'ITEM_FAILURES', lastSucceededAt: null })
    expect(fetch).toHaveBeenCalledWith('https://heartbeat.invalid/fixture/fail', expect.anything())
    expect(JSON.stringify(row)).not.toContain('secret')
  })

  it('retains the original exception and a safe failure code', async () => {
    const failure = new Error('private provider credential')
    await expect(
      withHeartbeat('translate-pending', async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(row).toMatchObject({ status: 'failed', failureCode: 'TASK_FAILED', lastSucceededAt: null })
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('private')
  })

  it('keeps newer replica state when an older run completes later', async () => {
    let entered!: () => void
    let finishOld!: (value: unknown) => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const old = withHeartbeat('translate-pending', () => {
      entered()
      return new Promise((resolve) => {
        finishOld = resolve
      })
    })
    await started
    const oldId = row!.runId
    vi.setSystemTime(new Date('2026-10-22T10:01:00Z'))
    await withHeartbeat('translate-pending', async () => ({ result: { processed: 4, failed: 0 } }))
    vi.setSystemTime(new Date('2026-10-22T10:02:00Z'))
    finishOld({ result: { processed: 1, failed: 1 } })
    await old
    expect(row!.runId).not.toBe(oldId)
    expect(row).toMatchObject({
      status: 'succeeded',
      processed: 4,
      failed: 0,
      lastSucceededAt: new Date('2026-10-22T10:01:00Z'),
      lastFailedAt: new Date('2026-10-22T10:02:00Z'),
    })
  })

  it('does not fail customer work when the status database and failure logger are unavailable', async () => {
    upsert.mockRejectedValue(new Error('database unreachable'))
    updateMany.mockRejectedValue(new Error('database unreachable'))
    log.error.mockRejectedValue(new Error('logger unreachable'))
    log.info.mockRejectedValue(new Error('logger unreachable'))
    const fallback = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(withHeartbeat('translate-pending', async () => 'completed')).resolves.toBe('completed')
    fallback.mockRestore()
  })
})
