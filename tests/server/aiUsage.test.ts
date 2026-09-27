import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { recordAiUsage } from '../../server/utils/aiUsage'

const create = vi.fn()
const logAction = vi.fn()
const reportCaughtError = vi.fn()

beforeEach(() => {
  create.mockReset()
  logAction.mockReset()
  reportCaughtError.mockReset()
  vi.stubGlobal('prisma', { aiUsage: { create } })
  vi.stubGlobal('logAction', logAction)
  vi.stubGlobal('reportCaughtError', reportCaughtError)
  vi.stubGlobal('getIp', () => '127.0.0.1')
})
afterEach(() => vi.unstubAllGlobals())

describe('AI usage log', () => {
  it('stores provider tokens with JSON-safe metadata and audits the action', async () => {
    await recordAiUsage('site', 1234.4, 'TRANSLATE_ARTICLE', { articleId: 'a', skipped: undefined })
    expect(create).toHaveBeenCalledWith({
      data: { clientSiteId: 'site', action: 'TRANSLATE_ARTICLE', tokens: 1234, metadata: { articleId: 'a' } },
    })
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TRANSLATE_ARTICLE', metadata: { articleId: 'a', apiTokens: 1234 } }),
    )
  })

  it('clamps missing or invalid usage to zero', async () => {
    await recordAiUsage('site', Number.NaN, 'SENTIMENT_ANALYSIS')
    expect(create.mock.calls[0]![0].data.tokens).toBe(0)
  })

  it('never fails the work it measures', async () => {
    create.mockRejectedValue(new Error('db down'))
    await expect(recordAiUsage('site', 10, 'ENHANCE_PROMPT')).resolves.toBeUndefined()
    expect(reportCaughtError).toHaveBeenCalledWith('AI usage logging failed', expect.any(Error), expect.anything())
  })
})
