// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../../server/utils/concurrency'), 'mapLimit')
  await stubNitroImports(import('../../../server/utils/linkedin/policy'), 'checkPolicyAndScore')
  await stubNitroImports(
    import('../../../server/utils/linkedin/publisher'),
    'publishApprovedDraft',
    'publishDecisionAndExecute',
  )
  await stubNitroImports(import('../../../server/utils/linkedin/generator'), 'generateContentForTask')
}

const { publish, generate, database } = vi.hoisted(() => ({
  publish: vi.fn(),
  generate: vi.fn(),
  database: {
    draftPost: { findMany: vi.fn(), create: vi.fn() },
    contentTask: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('../../../server/utils/prisma', () => ({ default: database }))
vi.mock('../../../server/utils/linkedin/publisher', () => ({
  publishApprovedDraft: publish,
  publishDecisionAndExecute: publish,
}))
vi.mock('../../../server/utils/linkedin/generator', () => ({ generateContentForTask: generate }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('requireCron', vi.fn())
  vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('LinkedIn publication cron', () => {
  it('bounds its queue and active provider work while reporting uncertain outcomes separately', async () => {
    database.draftPost.findMany.mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({ id: String(index) })))
    let active = 0
    let peak = 0
    publish.mockImplementation(async (id: string) => {
      active++
      peak = Math.max(peak, active)
      await Promise.resolve()
      active--
      return { status: id === '0' ? 'needs_review' : 'published' }
    })
    const handler = (await import('../../../server/api/crons/linkedin-publish')).default
    const result = await handler({} as never)
    expect(peak).toBeLessThanOrEqual(4)
    expect(database.draftPost.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
    expect(result).toMatchObject({ scanned: 12, published: 11, needsReview: 1, failed: 0 })
  })
})

describe('LinkedIn generation and publication boundary', () => {
  it('keeps a completed generation complete when only publication fails', async () => {
    let status = 'PENDING'
    database.contentTask.findMany.mockResolvedValue([{ id: 'task', topic: 'Offline', company: { clientSite: {} } }])
    database.contentTask.updateMany.mockImplementation(async ({ where, data }) => {
      if (where.status !== status) return { count: 0 }
      status = data.status
      return { count: 1 }
    })
    database.contentTask.update.mockImplementation(async ({ data }) => {
      status = data.status
      return {}
    })
    database.draftPost.create.mockResolvedValue({ id: 'draft' })
    generate.mockResolvedValue(
      'A sufficiently long offline LinkedIn post to satisfy the current deterministic scoring policy.',
    )
    publish.mockRejectedValue(new Error('synthetic publication failure'))
    const handler = (await import('../../../server/api/crons/linkedin-generate')).default
    await handler({} as never)
    expect(status).toBe('COMPLETED')
    expect(generate).toHaveBeenCalledTimes(1)
  })
})

beforeEach(stubImports)
