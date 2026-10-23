import { createError } from 'h3'
import { afterEach, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/linkedin/decision'), 'decideDraft')
}

await stubImports()

const { decideDraft } = await import('../../../server/utils/linkedin/decision')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it.each(['approve', 'reject'] as const)(
  'rolls back a %s decision if its required audit write fails',
  async (decision) => {
    let status = 'DRAFT'
    const auditFailure = new Error('Audit storage unavailable')
    const transaction = async (run: (tx: unknown) => Promise<unknown>) => {
      let staged = status
      const result = await run({
        draftPost: {
          findFirst: vi.fn().mockResolvedValue({ id: 'd1', status: staged }),
          updateMany: vi.fn().mockImplementation(({ data }) => {
            staged = data.status
            return { count: 1 }
          }),
        },
        approval: { create: vi.fn().mockRejectedValue(auditFailure) },
      })
      status = staged
      return result
    }
    const db = {
      draftPost: {
        update: vi.fn().mockImplementation(async ({ data }) => {
          status = data.status
          return { id: 'd1', status }
        }),
      },
      approval: { create: vi.fn().mockRejectedValue(auditFailure) },
      $transaction: vi.fn().mockImplementation(transaction),
    }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('requireTenantScope', async () => ({ user: { id: 'u1' }, membership: { clientSiteId: 's1' } }))
    vi.stubGlobal('getRouterParam', () => 'd1')
    vi.stubGlobal('readBody', async () => ({ reason: 'Needs revision' }))
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (input: unknown) => unknown) =>
      parse({ reason: 'Needs revision' }),
    )
    vi.stubGlobal('getEnhancedPrisma', async () => db)
    const handler =
      decision === 'approve'
        ? (await import('../../../server/api/drafts/[id]/approve.post')).default
        : (await import('../../../server/api/drafts/[id]/reject.post')).default
    await expect(handler({} as never)).rejects.toThrow(auditFailure)
    expect(status).toBe('DRAFT')
  },
)

const setupDecision = (status: string | null = 'DRAFT', updatedCount = 1) => {
  const create = vi.fn().mockResolvedValue({ id: 'audit-1' })
  const updateMany = vi.fn().mockResolvedValue({ count: updatedCount })
  const findFirst = vi.fn().mockResolvedValue(status ? { id: 'd1', status } : null)
  const tx = { draftPost: { findFirst, updateMany }, approval: { create } }
  const db = { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) }
  const input = {
    db: db as unknown as Parameters<typeof decideDraft>[0]['db'],
    draftId: 'd1',
    clientSiteId: 's1',
    reviewerId: 'u1',
    decision: 'APPROVE' as const,
    translate: (key: string) => key,
  }
  return { input, create, updateMany, findFirst }
}

it.each(['DRAFT', 'AWAITING_APPROVAL'])(
  'commits an authorized decision from %s with its audit record',
  async (status) => {
    const { input, create, findFirst } = setupDecision(status)
    await expect(decideDraft(input)).resolves.toEqual({ id: 'd1', status: 'APPROVED' })
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'd1',
          deletedAt: null,
          task: { deletedAt: null, company: { clientSiteId: 's1', deletedAt: null } },
        },
      }),
    )
    expect(create).toHaveBeenCalledWith({
      data: { draftId: 'd1', reviewerId: 'u1', decision: 'APPROVE', notes: null },
      select: { id: true },
    })
  },
)

it.each(['PUBLISHING', 'PUBLISHED', 'APPROVED', 'REJECTED', 'FAILED'])(
  'preserves a %s draft on a stale decision',
  async (status) => {
    const { input, create, updateMany } = setupDecision(status)
    await expect(decideDraft(input)).rejects.toMatchObject({ statusCode: 409 })
    expect(updateMany).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  },
)

it('does not write a decision when another request wins the state transition', async () => {
  const { input, create } = setupDecision('DRAFT', 0)
  await expect(decideDraft(input)).rejects.toMatchObject({ statusCode: 409 })
  expect(create).not.toHaveBeenCalled()
})

it('does not expose a draft outside the active tenant or with a deleted parent', async () => {
  const { input, create, updateMany } = setupDecision(null)
  await expect(decideDraft(input)).rejects.toMatchObject({ statusCode: 404 })
  expect(updateMany).not.toHaveBeenCalled()
  expect(create).not.toHaveBeenCalled()
})

beforeEach(stubImports)
