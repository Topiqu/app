import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

const setup = async (failure: 'plan' | 'lookup' | 'reservation' | 'session', articleQuality = 'STANDARD') => {
  const log = vi.fn().mockResolvedValue({})
  const settle = vi.fn()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () => ({ id: 'author-1', clientSiteId: 'tenant-1' }))
  vi.stubGlobal('requireTenantScope', vi.fn())
  vi.stubGlobal('ensureMinAccountAge', vi.fn())
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) =>
    parse({ prompt: 'Private editorial prompt' }),
  )
  vi.stubGlobal('getIp', () => '203.0.113.4')
  vi.stubGlobal('prisma', {
    clientSite: {
      findUnique: async () => {
        if (failure === 'lookup') throw new Error('Lookup failed')
        return { plan: failure === 'plan' ? 'BASIC' : 'PRO', articleQuality }
      },
    },
  })
  vi.stubGlobal('aiModelId', () => 'test-model')
  const reserve = vi.fn(async (...args: unknown[]) => {
    if (failure === 'reservation') throw new Error('No credits')
    return { id: 'operation-1', reserved: args[4] }
  })
  vi.stubGlobal('reserveArticleCredit', reserve)
  vi.stubGlobal('createGenerationSession', async () => {
    throw new Error('Recovery session unavailable')
  })
  vi.stubGlobal('settleArticleCredit', settle)
  vi.stubGlobal('logAction', log)
  vi.stubGlobal('reportCaughtError', vi.fn())
  const handler = (await import('../../../server/api/articles/generate/index.post')).default
  return { run: () => handler({} as never), log, settle, reserve }
}

describe('manual generation preflight audit', () => {
  it.each([
    ['STANDARD', 'high', 1],
    ['HIGH', 'xhigh', 2],
    ['ULTRA', 'max', 3],
  ] as const)('reserves the saved %s price before starting provider work', async (quality, effort, amount) => {
    const { run, reserve, settle } = await setup('session', quality)
    await expect(run()).rejects.toThrow('Recovery session unavailable')
    expect(reserve).toHaveBeenCalledWith(
      'tenant-1',
      'MANUAL_ARTICLE',
      expect.any(String),
      expect.objectContaining({ articleQuality: quality, writerEffort: effort, creditsRequired: amount }),
      amount,
    )
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({ reserved: amount }), false, expect.anything())
  })
  it.each([
    ['plan', 'MANUAL_GENERATION_REJECTED', 'preflight'],
    ['lookup', 'MANUAL_GENERATION_FAILED', 'preflight'],
    ['reservation', 'MANUAL_GENERATION_REJECTED', 'reservation'],
    ['session', 'MANUAL_GENERATION_FAILED', 'session'],
  ] as const)('records %s failures with the attempt ID before streaming starts', async (failure, action, stage) => {
    const { run, log, settle } = await setup(failure)
    await expect(run()).rejects.toThrow()
    const entries = log.mock.calls.map(([entry]) => entry)
    const started = entries.find((entry) => entry.action === 'MANUAL_GENERATION_STARTED')
    expect(entries.find((entry) => entry.action === action).metadata).toMatchObject({
      stage,
      attemptId: started.metadata.attemptId,
    })
    expect(JSON.stringify(entries)).not.toContain('Private editorial prompt')
    if (failure === 'session')
      expect(settle).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'operation-1' }),
        false,
        expect.objectContaining({ stage: 'session' }),
      )
    else expect(settle).not.toHaveBeenCalled()
  })
})
