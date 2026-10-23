// @vitest-environment nuxt

import { effectScope, nextTick, reactive } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ArticleFactCheckInput, ArticleFactCheckResult } from '../../shared/types/articleFactCheck'

import { useArticleFactCheck } from '../../app/composables/useArticleFactCheck'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
mockNuxtImport('$fetch', () => mocks.fetch)

const report: ArticleFactCheckResult = {
  analyzedAt: '2026-10-22T12:00:00Z',
  claims: [],
  sources: [],
  counts: { supported: 0, partial: 0, unsupported: 0, contradicted: 0, unverifiable: 0, total: 0, problematic: 0 },
}
const scopes: ReturnType<typeof effectScope>[] = []
const setup = () => {
  const scope = effectScope()
  scopes.push(scope)
  const input = reactive<ArticleFactCheckInput>({
    title: 'A verifiable article',
    excerpt: null,
    content: '<p>This content is long enough to be fact checked.</p>',
    sources: ['https://example.com/first'],
    language: 'en',
  })
  const factCheck = scope.run(() => useArticleFactCheck(() => input))!
  return { input, scope, factCheck }
}
const deferred = () => {
  let resolve!: (result: ArticleFactCheckResult) => void
  let reject!: (error: Error) => void
  const promise = new Promise<ArticleFactCheckResult>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => mocks.fetch.mockReset().mockResolvedValue(report))
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))

describe('editor fact-check requests', () => {
  it('runs one paid request at a time and marks a changed document stale without changing the request snapshot', async () => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const { input, factCheck } = setup()
    const run = factCheck.run()
    await factCheck.run()
    input.sources.push('https://example.com/second')
    input.language = 'cs'
    await nextTick()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.fetch.mock.lastCall![1].body).toMatchObject({ sources: ['https://example.com/first'], language: 'en' })
    pending.resolve(report)
    await run
    expect(factCheck.result.value).toBe(report)
    expect(factCheck.state.value).toBe('stale')
  })

  it.each(['success', 'failure'] as const)('aborts on disposal and ignores late %s', async (outcome) => {
    const pending = deferred()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const { scope, factCheck } = setup()
    const run = factCheck.run()
    scope.stop()
    expect(mocks.fetch.mock.lastCall![1].signal.aborted).toBe(true)
    if (outcome === 'success') pending.resolve(report)
    else pending.reject(new Error('Canceled request'))
    await run
    expect(factCheck.result.value).toBeNull()
    expect(factCheck.failure.value).toBeNull()
    await factCheck.run()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [{ statusCode: 429 }, 'rate-limited'],
    [{ statusCode: 503, data: { data: { code: 'AI_NOT_CONFIGURED' } } }, 'not-configured'],
    [null, 'unknown'],
  ])('classifies current failures without throwing for a non-Error rejection', async (error, expectedKind) => {
    mocks.fetch.mockRejectedValueOnce(error)
    const { factCheck } = setup()
    await factCheck.run()
    expect(factCheck.state.value).toBe('error')
    expect(factCheck.errorKind.value).toBe(expectedKind)
  })
})
