// @vitest-environment nuxt

import { afterEach, describe, expect, it, vi } from 'vitest'

import { useArticleGeneration } from '../../app/composables/useArticleGeneration'
import { defaultArticleGenerationOptions, type GenerationEvent } from '../../shared/utils/articleGeneration'

afterEach(() => vi.unstubAllGlobals())

describe('generation progress stream', () => {
  it('forwards real review transitions in order and ignores transport heartbeats', async () => {
    const stages = ['verifying', 'checking', 'revising', 'rechecking'] as const
    const lines = stages.flatMap((stage) => [{ type: 'heartbeat' }, { type: 'review-progress', stage }])
    const article = { title: 'Finished article', content: '<p>Finished.</p>' }
    const body = [...lines, { type: 'final', article }].map((line) => JSON.stringify(line)).join('\n')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)))
    const events: GenerationEvent[] = []
    const onFinal = vi.fn()
    const generation = useArticleGeneration()

    await expect(
      generation.streamGenerate('Topic', defaultArticleGenerationOptions(), {
        onEvent: (event) => events.push(event),
        onFinal,
      }),
    ).resolves.toBe('completed')
    expect(events).toEqual([...stages.map((stage) => ({ type: 'review-progress', stage })), { type: 'final', article }])
    expect(onFinal).toHaveBeenCalledWith(article)
    expect(generation.generating.value).toBe(false)
  })

  it('waits out the first minute of a new account and then generates instead of failing', async () => {
    vi.useFakeTimers()
    try {
      const tooNew = { statusCode: 429, message: 'Too new', data: { code: 'ACCOUNT_TOO_NEW', retryAfterMs: 20_000 } }
      const article = { title: 'Finished article', content: '<p>Finished.</p>' }
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(tooNew), { status: 429 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ type: 'final', article })))
      vi.stubGlobal('fetch', fetch)
      const onFinal = vi.fn()
      const run = useArticleGeneration().streamGenerate('Topic', defaultArticleGenerationOptions(), { onFinal })
      await vi.advanceTimersByTimeAsync(19_000)
      expect(fetch).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(2_000)
      await expect(run).resolves.toBe('completed')
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(onFinal).toHaveBeenCalledWith(article)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry other rate limits', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Slow down' }), { status: 429 }))
    vi.stubGlobal('fetch', fetch)
    await expect(
      useArticleGeneration().streamGenerate('Topic', defaultArticleGenerationOptions(), { onFinal: vi.fn() }),
    ).rejects.toThrow('Slow down')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
