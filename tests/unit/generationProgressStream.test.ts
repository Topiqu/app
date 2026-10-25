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
})
