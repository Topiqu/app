// @vitest-environment node
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isAiAllowanceError } from '../../../shared/utils/aiAllowanceError'
import { aiLanguageSpend, aiTextCostMicros, aiTextPrice, withAiSpend } from '../../../server/utils/ai/spend'

const reserve = vi.fn()
const settle = vi.fn()
beforeEach(() => {
  reserve.mockImplementation(async (clientSiteId: string, kind: string, amount: number) => ({
    id: 'reservation',
    clientSiteId,
    kind,
    reserved: amount,
  }))
  settle.mockResolvedValue(undefined)
  vi.stubGlobal('reserveAiAllowance', reserve)
  vi.stubGlobal('settleAiAllowance', settle)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('reportCaughtError', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const usage = { inputTokens: { total: 100 }, outputTokens: { total: 20 } }
const params = { prompt: [{ role: 'user', content: [{ type: 'text', text: 'A question' }] }], maxOutputTokens: 200 }

describe('funded provider calls', () => {
  it('fails closed before an unattributed call reaches the provider', async () => {
    const provider = vi.fn()
    const middleware = aiLanguageSpend('textEdit', 'gpt-6-luna')
    await expect(middleware.wrapGenerate!({ doGenerate: provider, params } as never)).rejects.toMatchObject({
      data: { code: 'AI_CONTEXT_REQUIRED' },
    })
    expect(provider).not.toHaveBeenCalled()
  })
  it('keeps concurrent tenant context isolated and settles only measured tokens and search calls', async () => {
    const middleware = aiLanguageSpend('articleWriter', 'gpt-6-luna')
    const run = () => middleware.wrapGenerate!({ params, doGenerate: async () => ({ usage, content: [] }) } as never)
    await Promise.all([withAiSpend('blog-a', run), withAiSpend('blog-b', run)])
    expect(reserve.mock.calls.map((args) => args[0]).sort()).toEqual(['blog-a', 'blog-b'])
    expect(settle.mock.calls.map((args) => args[1])).toEqual([20, 20])
  })
  it('charges actual search calls, not the entire search reservation on success', async () => {
    const middleware = aiLanguageSpend('articleResearch', 'claude-haiku-5-5', 'blog-a')
    await middleware.wrapGenerate!({
      params: {
        ...params,
        tools: [{ type: 'provider', id: 'anthropic.web_search_20250305', name: 'web_search', args: {} }],
      },
      doGenerate: async () => ({ usage, content: [{ type: 'tool-call', toolName: 'web_search' }] }),
    } as never)
    expect(reserve.mock.calls[0]![2]).toBeGreaterThan(100_000)
    expect(settle.mock.calls[0]![1]).toBe(10_020)
  })
  it('retains uncertain cost on a provider failure', async () => {
    const middleware = aiLanguageSpend('textEdit', 'gpt-6-luna', 'blog-a')
    await expect(
      middleware.wrapGenerate!({
        params,
        doGenerate: async () => {
          throw new Error('Connection lost')
        },
      } as never),
    ).rejects.toThrow('Connection lost')
    expect(settle).toHaveBeenCalledWith(expect.anything(), null)
  })
  it('does not turn delivered provider output into a failed operation when settlement is unavailable', async () => {
    settle.mockRejectedValue(new Error('Accounting unavailable'))
    const middleware = aiLanguageSpend('textEdit', 'gpt-6-luna', 'blog-a')
    await expect(
      middleware.wrapGenerate!({ params, doGenerate: async () => ({ usage, content: [] }) } as never),
    ).resolves.toMatchObject({ usage })
    expect(reportCaughtError).toHaveBeenCalled()
  })
  it('does not truncate an explicitly sized quality or thinking budget', async () => {
    const middleware = aiLanguageSpend('articleWriter', 'gpt-6.1-sol', 'blog-a')
    expect(
      await middleware.transformParams!({ params: { ...params, maxOutputTokens: 66_000 } } as never),
    ).toMatchObject({ maxOutputTokens: 66_000 })
  })
  it('rejects a different tenant nested in an article stage', () => {
    expect(() => withAiSpend('blog-a', () => withAiSpend('blog-b', () => undefined))).toThrow('tenant context mismatch')
  })
  it('uses the long-context rate, rejects unknown prices and recognizes wrapped entitlement errors', () => {
    expect(aiTextPrice('claude-haiku-5-5', 100_001)).toEqual({ input: 0.5, output: 2.5 })
    expect(aiTextCostMicros('gpt-6.1-sol', 1000, 1000)).toBe(12_000)
    expect(() => aiTextPrice('unreviewed-model', 1)).toThrow()
    expect(
      isAiAllowanceError({ lastError: createError({ statusCode: 402, data: { code: 'AI_ALLOWANCE_EXHAUSTED' } }) }),
    ).toBe(true)
    expect(isAiAllowanceError(new Error('Provider outage'))).toBe(false)
  })
})
