import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'

import { z } from 'zod'
import { Output, streamText } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, it, vi } from 'vitest'

import { articleWriterStream } from '../../../server/utils/ai/articleStream'

const schema = z.object({ title: z.string(), content: z.string() })
const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 7, text: 7, reasoning: 0 },
}

const writer = () => {
  let provider!: ReadableStreamDefaultController<LanguageModelV4StreamPart>
  const model = new MockLanguageModelV4({
    doStream: {
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          provider = controller
          controller.enqueue({ type: 'stream-start', warnings: [] })
          controller.enqueue({ type: 'text-start', id: 'article' })
        },
      }),
    },
  })
  const result = streamText({ model, output: Output.object({ schema }), prompt: 'Write an article', onError: () => {} })
  const delta = (text: string) => provider.enqueue({ type: 'text-delta', id: 'article', delta: text })
  const finish = () => {
    provider.enqueue({ type: 'text-end', id: 'article' })
    provider.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage })
    provider.close()
  }
  return { result, provider, delta, finish }
}

describe('article writer SDK streams', () => {
  it('forwards activity before fields exist, partial fields before completion and the final usage', async () => {
    const { result, delta, finish } = writer()
    const received: Array<{ type: string; output?: { title?: string; content?: string } }> = []
    const consume = (async () => {
      for await (const event of articleWriterStream(result)) received.push(event)
    })()

    await vi.waitFor(() => expect(received).toContainEqual({ type: 'activity' }))
    expect(received.some((event) => event.type === 'partial')).toBe(false)

    delta('{"title":"A title",')
    await vi.waitFor(() => expect(received).toContainEqual({ type: 'partial', output: { title: 'A title' } }))

    delta('"content":"The body."}')
    finish()
    await consume
    expect(received).toContainEqual({ type: 'partial', output: { title: 'A title', content: 'The body.' } })
    expect(await result.output).toEqual({ title: 'A title', content: 'The body.' })
    expect((await result.usage).totalTokens).toBe(10)
  })

  it('forwards provider errors instead of silently waiting on the partial output stream', async () => {
    const { result, provider } = writer()
    const failure = new Error('Provider disconnected')
    provider.enqueue({ type: 'error', error: failure })
    provider.close()

    const received = []
    for await (const event of articleWriterStream(result)) received.push(event)
    expect(received).toContainEqual({ type: 'error', error: failure })
    await expect(result.output).rejects.toThrow()
  })

  it('rejects invalid final output while preserving the recoverable partial draft', async () => {
    const { result, delta, finish } = writer()
    delta('{"title":"Recoverable title"}')
    finish()
    const received = []
    for await (const event of articleWriterStream(result)) received.push(event)
    expect(received).toContainEqual({ type: 'partial', output: { title: 'Recoverable title' } })
    await expect(result.output).rejects.toThrow()
  })

  it('closes both readers when a consumer stops without awaiting a stuck provider', async () => {
    const eventsReturn = vi.fn(async () => ({ done: true as const, value: undefined }))
    const outputsReturn = vi.fn(() => new Promise<IteratorResult<{ title: string }>>(() => {}))
    const events = {
      [Symbol.asyncIterator]: () => ({
        next: vi.fn(async () => ({ done: false as const, value: { type: 'text-delta' } })),
        return: eventsReturn,
      }),
    }
    const outputs = {
      [Symbol.asyncIterator]: () => ({
        next: () => new Promise<IteratorResult<{ title: string }>>(() => {}),
        return: outputsReturn,
      }),
    }
    for await (const event of articleWriterStream({ stream: events, partialOutputStream: outputs })) {
      expect(event.type).toBe('activity')
      break
    }
    expect(eventsReturn).toHaveBeenCalledOnce()
    expect(outputsReturn).toHaveBeenCalledOnce()
  })
})
