import { afterEach, describe, expect, it, vi } from 'vitest'

import { logAction } from '../../server/utils/log'

afterEach(() => vi.unstubAllGlobals())

describe('value audit receipts', () => {
  it('records a completed operation only once when the same idempotency key is retried', async () => {
    const rows: Array<{ id: string; hash: string; idempotencyKey: string | null }> = []
    const info = vi.fn()
    const db = {
      $executeRaw: vi.fn(),
      log: {
        findUnique: vi.fn(
          async ({ where }: { where: { idempotencyKey: string } }) =>
            rows.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
        ),
        findFirst: vi.fn(async () => rows.at(-1) ?? null),
        create: vi.fn(async ({ data }: { data: { hash: string; idempotencyKey: string | null } }) => {
          const row = { id: String(rows.length + 1), ...data }
          rows.push(row)
          return row
        }),
      },
    }
    vi.stubGlobal('prisma', { $transaction: (write: (client: typeof db) => unknown) => write(db) })
    vi.stubGlobal('logger', { info })

    const input = {
      action: 'CRON_ARTICLE_PUBLISHED',
      clientSiteId: 'tenant-1',
      userId: 'author-1',
      idempotencyKey: 'cron-generation:article-1',
      metadata: { generatedWordCount: 800 },
    }
    const first = await logAction(input)
    const retried = await logAction(input)

    expect(retried).toBe(first)
    expect(db.log.create).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledTimes(1)
  })
})
