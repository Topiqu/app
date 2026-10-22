// @vitest-environment node
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockEmbeddingModelV4, MockImageModelV4, MockLanguageModelV4 } from 'ai/test'
import { generateText, wrapEmbeddingModel, wrapImageModel, wrapLanguageModel } from 'ai'

import {
  articleEmbeddingUsage,
  articleImageUsage,
  articleLanguageUsage,
  withArticleUsage,
  withArticleUsageStage,
} from '../../../server/utils/ai/articleUsage'

const { record } = vi.hoisted(() => ({ record: vi.fn() }))
vi.mock('../../../server/utils/aiUsage', () => ({ recordAiUsage: record }))

const context = {
  attemptId: 'attempt',
  clientSiteId: 'site',
  operationId: 'op',
  articleQuality: 'ULTRA' as const,
  mode: 'manual' as const,
}
const usage = {
  inputTokens: { total: 120, noCache: 80, cacheRead: 30, cacheWrite: 10 },
  outputTokens: { total: 40, text: 15, reasoning: 25 },
  raw: { server_tool_use: { web_search_requests: 2 }, cache_creation: { ephemeral_5m_input_tokens: 10 } },
}
const middleware = () => articleLanguageUsage('articleWriter', 'anthropic', 'claude-opus-5-5')
const model = () =>
  wrapLanguageModel({
    model: new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: 'text', text: 'Private body' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage,
      },
    }),
    middleware: middleware(),
  })
const streamModel = (stream: ReadableStream<LanguageModelV4StreamPart>) =>
  wrapLanguageModel({ model: new MockLanguageModelV4({ doStream: { stream } }), middleware: middleware() })
const read = async (stream: ReadableStream<LanguageModelV4StreamPart>) => {
  const result = []
  for await (const part of stream) result.push(part)
  return result
}

beforeEach(() => {
  record.mockReset().mockResolvedValue(undefined)
})

describe('article provider usage', () => {
  it('records the first writer and revision separately with cache, reasoning and search usage', async () => {
    await withArticleUsage(context, async () => {
      for (const stage of ['writing', 'revision'])
        await withArticleUsageStage(stage, () => generateText({ model: model(), prompt: 'Private prompt' }))
    })
    expect(record).toHaveBeenCalledTimes(2)
    for (const [index, stage] of ['writing', 'revision'].entries()) {
      expect(record.mock.calls[index]).toEqual([
        'site',
        160,
        'ARTICLE_PROVIDER_USAGE',
        expect.objectContaining({
          ...context,
          stage,
          model: 'claude-opus-5-5',
          task: 'articleWriter',
          status: 'completed',
          usageKnown: true,
          inputTokens: 120,
          uncachedInputTokens: 80,
          cachedInputTokens: 30,
          cacheWriteTokens: 10,
          outputTokens: 40,
          reasoningTokens: 25,
          providerUsage: usage.raw,
        }),
        undefined,
        undefined,
      ])
    }
    expect(record.mock.calls[0]![3].callId).not.toBe(record.mock.calls[1]![3].callId)
    expect(JSON.stringify(record.mock.calls)).not.toContain('Private')
  })

  it('keeps concurrent tenants and attempts separate', async () => {
    await Promise.all(
      ['one', 'two'].map((id) =>
        withArticleUsage({ ...context, clientSiteId: id, attemptId: id }, async () => {
          await Promise.resolve()
          await generateText({ model: model(), prompt: id })
        }),
      ),
    )
    expect(record.mock.calls.map(([site, , , metadata]) => [site, metadata.attemptId]).sort()).toEqual([
      ['one', 'one'],
      ['two', 'two'],
    ])
  })

  it('does not record unrelated model calls outside an article attempt', async () => {
    await generateText({ model: model(), prompt: 'Other AI feature' })
    expect(record).not.toHaveBeenCalled()
  })

  it('records streaming usage once while forwarding the original parts', async () => {
    const parts: LanguageModelV4StreamPart[] = [
      { type: 'text-start', id: 'text' },
      { type: 'text-delta', id: 'text', delta: 'Private body' },
      { type: 'finish', usage, finishReason: { unified: 'stop', raw: 'stop' } },
    ]
    const stream = new ReadableStream<LanguageModelV4StreamPart>({
      start(controller) {
        parts.forEach((part) => controller.enqueue(part))
        controller.close()
      },
    })
    const result = await withArticleUsage(context, () => streamModel(stream).doStream({ prompt: [] }))
    expect(await read(result.stream)).toEqual(parts)
    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0]![3]).toMatchObject({
      ...context,
      status: 'completed',
      inputTokens: 120,
      outputTokens: 40,
    })
  })

  it('keeps unknown spend explicit after a failed or cancelled provider call', async () => {
    const broken = wrapLanguageModel({
      model: new MockLanguageModelV4({
        doGenerate: async () => {
          throw new Error('Provider failed')
        },
      }),
      middleware: middleware(),
    })
    await expect(
      withArticleUsage(context, () => generateText({ model: broken, prompt: 'Private prompt', maxRetries: 0 })),
    ).rejects.toThrow('Provider failed')
    expect(record.mock.calls[0]![3]).toMatchObject({ status: 'failed', usageKnown: false })
    const cancelled = new ReadableStream<LanguageModelV4StreamPart>({ start() {} })
    const result = await withArticleUsage(context, () => streamModel(cancelled).doStream({ prompt: [] }))
    await result.stream.cancel()
    expect(record.mock.calls[1]![3]).toMatchObject({ status: 'cancelled', usageKnown: false })
  })

  it('records a broken stream without inventing token consumption', async () => {
    const result = await withArticleUsage(context, () =>
      streamModel(
        new ReadableStream({
          start(controller) {
            controller.error(new Error('Connection lost'))
          },
        }),
      ).doStream({ prompt: [] }),
    )
    await expect(read(result.stream)).rejects.toThrow('Connection lost')
    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0]![3]).toMatchObject({ status: 'failed', usageKnown: false })
  })

  it('records image usage before CDN work without retaining the revised prompt', async () => {
    const image = wrapImageModel({
      model: new MockImageModelV4({
        doGenerate: async () => ({
          images: [new Uint8Array([1])],
          warnings: [],
          response: { timestamp: new Date(), modelId: 'image', headers: undefined },
          usage: { inputTokens: 20, outputTokens: 100, totalTokens: 120 },
          providerMetadata: {
            openai: { images: [{ textTokens: 20, imageTokens: 0, revisedPrompt: 'Private image prompt' }] },
          },
        }),
      }),
      middleware: articleImageUsage('articleImage', 'openai', 'gpt-image-2.5-flare'),
    })
    await withArticleUsage(context, () =>
      image.doGenerate({
        prompt: 'Private image prompt',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: { openai: { quality: 'medium' } },
      }),
    )
    expect(record.mock.calls[0]![3]).toMatchObject({
      inputTokens: 20,
      outputTokens: 100,
      imageCount: 1,
      imageTokenDetails: [{ textTokens: 20, imageTokens: 0 }],
    })
    expect(JSON.stringify(record.mock.calls)).not.toContain('Private')
  })

  it('records query embedding tokens alongside the same article operation', async () => {
    const embedding = wrapEmbeddingModel({
      model: new MockEmbeddingModelV4({ doEmbed: { embeddings: [[0.1]], usage: { tokens: 12 }, warnings: [] } }),
      middleware: articleEmbeddingUsage('knowledge', 'openai', 'text-embedding-3-small'),
    })
    await withArticleUsage(context, () => embedding.doEmbed({ values: ['Private knowledge query'] }))
    expect(record.mock.calls[0]![3]).toMatchObject({
      operationId: 'op',
      task: 'knowledge',
      inputTokens: 12,
      outputTokens: 0,
    })
  })

  it('preserves a completed article when logging fails', async () => {
    record.mockRejectedValue(new Error('Telemetry down'))
    expect((await withArticleUsage(context, () => generateText({ model: model(), prompt: 'Write' }))).text).toBe(
      'Private body',
    )
  })
})
