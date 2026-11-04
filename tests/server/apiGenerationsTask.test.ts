import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/tasks/generate-article', () => ({
  loadGenerationClient: vi.fn(),
  processClient: vi.fn(),
}))
vi.stubGlobal('defineMonitoredTask', (definition: unknown) => definition)
vi.stubGlobal('API_GENERATION_TIMEOUT_MS', 45 * 60_000)

const { loadGenerationClient, processClient } = await import('../../server/tasks/generate-article')
const task = await import('../../server/tasks/api-generations')

const generation = {
  id: 'gen-1',
  clientSiteId: 'site-1',
  apiKeyId: 'key-1',
  topic: 'Pond care in winter',
  instructions: null,
}

describe('api-generations task', () => {
  let updateMany: ReturnType<typeof vi.fn>
  let enqueueGenerationWebhook: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.mocked(processClient).mockClear()
    updateMany = vi.fn().mockResolvedValue({ count: 1 })
    enqueueGenerationWebhook = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('enqueueGenerationWebhook', enqueueGenerationWebhook)
    vi.stubGlobal('requireApiGenerationAccess', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('prisma', { apiGeneration: { updateMany } })
    vi.mocked(loadGenerationClient).mockResolvedValue({ id: 'site-1' } as never)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('defineMonitoredTask', (definition: unknown) => definition)
    vi.stubGlobal('API_GENERATION_TIMEOUT_MS', 45 * 60_000)
  })

  it('writes the requested topic and reports the draft', async () => {
    vi.mocked(processClient).mockResolvedValue({ status: 'draft', articleId: 'article-1' } as never)
    await expect(task.runApiGeneration(generation)).resolves.toEqual({
      id: 'gen-1',
      status: 'succeeded',
      articleId: 'article-1',
    })
    expect(processClient).toHaveBeenCalledWith({ id: 'site-1' }, expect.any(Date), {
      generationId: 'gen-1',
      topic: 'Pond care in winter',
      instructions: null,
    })
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'gen-1', status: 'RUNNING' },
      data: expect.objectContaining({ status: 'SUCCEEDED', articleId: 'article-1' }),
    })
    expect(enqueueGenerationWebhook).toHaveBeenCalledWith('GENERATION_SUCCEEDED', {
      id: 'gen-1',
      clientSiteId: 'site-1',
    })
  })

  it('reports a failed generation with its reason', async () => {
    vi.mocked(processClient).mockResolvedValue({ status: 'failed', error: 'Insufficient article credits' } as never)
    await expect(task.runApiGeneration(generation)).resolves.toMatchObject({ status: 'failed' })
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'gen-1', status: 'RUNNING' },
      data: expect.objectContaining({ status: 'FAILED', error: 'Insufficient article credits' }),
    })
    expect(enqueueGenerationWebhook).toHaveBeenCalledWith('GENERATION_FAILED', expect.anything())
  })

  it('stops queued work before any provider call when access has been revoked', async () => {
    vi.stubGlobal('requireApiGenerationAccess', vi.fn().mockRejectedValue(new Error('API key revoked')))
    await expect(task.runApiGeneration(generation)).resolves.toMatchObject({ status: 'failed' })
    expect(processClient).not.toHaveBeenCalled()
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', error: 'API key revoked' }) }),
    )
  })

  it('does not overwrite a run already declared lost, nor notify twice', async () => {
    vi.mocked(processClient).mockResolvedValue({ status: 'draft', articleId: 'article-1' } as never)
    updateMany.mockResolvedValue({ count: 0 })
    await task.runApiGeneration(generation)
    expect(enqueueGenerationWebhook).not.toHaveBeenCalled()
  })

  it('claims a queued request with a guarded update', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'gen-1' })
    const findUniqueOrThrow = vi.fn().mockResolvedValue(generation)
    updateMany.mockResolvedValueOnce({ count: 0 })
    vi.stubGlobal('prisma', { apiGeneration: { findFirst, updateMany, findUniqueOrThrow } })
    await expect(task.claimApiGeneration()).resolves.toBeNull()
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'gen-1', status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: expect.any(Date) },
    })
    await expect(task.claimApiGeneration()).resolves.toEqual(generation)
  })

  it('fails runs that outlived their worker', async () => {
    const now = new Date('2026-11-04T12:00:00Z')
    const findMany = vi.fn().mockResolvedValue([{ id: 'gen-9', clientSiteId: 'site-1' }])
    vi.stubGlobal('prisma', { apiGeneration: { findMany, updateMany } })
    await expect(task.failLostApiGenerations(now)).resolves.toBe(1)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'RUNNING', startedAt: { lt: new Date('2026-11-04T11:15:00Z') } },
      }),
    )
    expect(enqueueGenerationWebhook).toHaveBeenCalledWith('GENERATION_FAILED', { id: 'gen-9', clientSiteId: 'site-1' })
  })
})
