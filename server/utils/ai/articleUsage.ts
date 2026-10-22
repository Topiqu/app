import type { LanguageModelV4Usage } from '@ai-sdk/provider'
import type { ArticleQuality } from '~~/shared/utils/articleQuality'
import type { EmbeddingModelMiddleware, ImageModelMiddleware, LanguageModelMiddleware } from 'ai'

import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'

import { recordAiUsage } from '../aiUsage'

type Context = {
  attemptId: string
  clientSiteId: string
  operationId: string
  articleQuality: ArticleQuality
  mode: 'manual' | 'scheduled'
  userId?: string
  stage?: string
}

const context = new AsyncLocalStorage<Context>()

/** Request-local attribution also survives concurrent sites, images and a streaming writer. */
export const withArticleUsage = <T>(value: Context, run: () => T): T => context.run(value, run)

export const bindArticleUsage =
  <Args extends unknown[], Result>(value: Context | ((...args: Args) => Context), run: (...args: Args) => Result) =>
  (...args: Args): Result =>
    withArticleUsage(typeof value === 'function' ? value(...args) : value, () => run(...args))

export const withArticleUsageStage = <T>(stage: string, run: () => T): T => {
  const current = context.getStore()
  return current ? context.run({ ...current, stage }, run) : run()
}

const languageUsage = (usage: LanguageModelV4Usage) => ({
  inputTokens: usage.inputTokens.total ?? null,
  uncachedInputTokens: usage.inputTokens.noCache ?? null,
  cachedInputTokens: usage.inputTokens.cacheRead ?? null,
  cacheWriteTokens: usage.inputTokens.cacheWrite ?? null,
  outputTokens: usage.outputTokens.total ?? null,
  reasoningTokens: usage.outputTokens.reasoning ?? null,
  // Provider usage contains search counts and cache durations needed to reconcile the invoice.
  // Prompts, output text, images and request/response bodies are deliberately excluded.
  providerUsage: usage.raw ?? null,
})

const recorder = (task: string, provider: string, model: string) => {
  const current = context.getStore()
  const callId = randomUUID()
  const startedAt = Date.now()
  let recorded = false
  return async (status: 'completed' | 'failed' | 'cancelled' | 'incomplete', usage?: Record<string, unknown>) => {
    if (!current || recorded) return
    recorded = true
    const input = typeof usage?.inputTokens === 'number' ? usage.inputTokens : 0
    const output = typeof usage?.outputTokens === 'number' ? usage.outputTokens : 0
    try {
      await recordAiUsage(
        current.clientSiteId,
        input + output,
        'ARTICLE_PROVIDER_USAGE',
        {
          ...current,
          callId,
          task,
          provider,
          model,
          status,
          usageKnown:
            usage != null && (typeof usage.inputTokens === 'number' || typeof usage.outputTokens === 'number'),
          durationMs: Math.max(0, Date.now() - startedAt),
          ...usage,
        },
        undefined,
        current.userId,
      )
    } catch {
      // Telemetry must never interrupt the article, including when the reporting backend fails.
    }
  }
}

export const articleLanguageUsage = (task: string, provider: string, model: string): LanguageModelMiddleware => ({
  async wrapGenerate({ doGenerate }) {
    if (!context.getStore()) return doGenerate()
    const record = recorder(task, provider, model)
    try {
      const result = await doGenerate()
      await record(result.finishReason.unified === 'error' ? 'failed' : 'completed', languageUsage(result.usage))
      return result
    } catch (error) {
      await record('failed')
      throw error
    }
  },
  async wrapStream({ doStream }) {
    if (!context.getStore()) return doStream()
    const record = recorder(task, provider, model)
    try {
      const result = await doStream()
      const reader = result.stream.getReader()
      let failed = false
      return {
        ...result,
        stream: new ReadableStream({
          async pull(controller) {
            try {
              const part = await reader.read()
              if (part.done) {
                await record(failed ? 'failed' : 'incomplete')
                controller.close()
                return
              }
              if (part.value.type === 'error') failed = true
              if (part.value.type === 'finish')
                await record(
                  failed || part.value.finishReason.unified === 'error' ? 'failed' : 'completed',
                  languageUsage(part.value.usage),
                )
              controller.enqueue(part.value)
            } catch (error) {
              await record('failed')
              controller.error(error)
            }
          },
          async cancel(reason) {
            await record('cancelled')
            await reader.cancel(reason)
          },
        }),
      }
    } catch (error) {
      await record('failed')
      throw error
    }
  },
})

export const articleImageUsage = (task: string, provider: string, model: string): ImageModelMiddleware => ({
  async wrapGenerate({ doGenerate, params }) {
    if (!context.getStore()) return doGenerate()
    const record = recorder(task, provider, model)
    try {
      const result = await doGenerate()
      // Keep numeric image token details without storing the revised prompt returned beside them.
      const images = result.providerMetadata?.openai?.images.map((image) =>
        image && typeof image === 'object'
          ? Object.fromEntries(Object.entries(image).filter(([, value]) => typeof value === 'number'))
          : {},
      )
      await record('completed', {
        inputTokens: result.usage?.inputTokens ?? null,
        outputTokens: result.usage?.outputTokens ?? null,
        imageCount: result.images.length,
        size: params.size ?? null,
        quality: params.providerOptions?.openai?.quality ?? null,
        imageTokenDetails: images ?? [],
      })
      return result
    } catch (error) {
      await record('failed')
      throw error
    }
  },
})

export const articleEmbeddingUsage = (task: string, provider: string, model: string): EmbeddingModelMiddleware => ({
  async wrapEmbed({ doEmbed }) {
    if (!context.getStore()) return doEmbed()
    const record = recorder(task, provider, model)
    try {
      const result = await doEmbed()
      await record('completed', { inputTokens: result.usage?.tokens ?? null, outputTokens: 0 })
      return result
    } catch (error) {
      await record('failed')
      throw error
    }
  },
})
