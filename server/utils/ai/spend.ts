import type { LanguageModelV4CallOptions, LanguageModelV4Usage } from '@ai-sdk/provider'
import type { EmbeddingModelMiddleware, ImageModelMiddleware, LanguageModelMiddleware } from 'ai'

import { AsyncLocalStorage } from 'node:async_hooks'

const spend = new AsyncLocalStorage<{ clientSiteId: string; articleOperationId?: string }>()
export const AI_PRICE_VERSION = '2026-11-04-standard-v1'

/** Nested article stages share their blog's funding; a different tenant cannot inherit it. */
export const withAiSpend = <T>(clientSiteId: string, run: () => T, articleOperationId?: string): T => {
  const current = spend.getStore()
  if (current && current.clientSiteId !== clientSiteId) throw new Error('AI tenant context mismatch')
  return spend.run({ clientSiteId, articleOperationId: articleOperationId ?? current?.articleOperationId }, run)
}

export const aiSpendSiteId = (explicit?: string) => {
  const current = spend.getStore()?.clientSiteId
  if (explicit && current && explicit !== current) throw new Error('AI tenant context mismatch')
  const id = explicit ?? current
  if (!id)
    throw createError({ statusCode: 500, message: 'AI attribution missing', data: { code: 'AI_CONTEXT_REQUIRED' } })
  return id
}

// USD per million tokens = micro-USD per token. Standard public rates, with no assumed cache discount.
// Sources: developers.openai.com/api/docs/pricing and anthropic.com/claude-haiku-5-5.
export const aiTextPrice = (model: string, input: number) => {
  switch (model) {
    case 'gpt-6-luna':
      return { input: 0.1, output: 0.5 }
    case 'gpt-6.1-terra':
      return { input: 1, output: 5 }
    case 'gpt-6.1-sol':
      return { input: 2, output: 10 }
    case 'claude-haiku-5-5':
      return input > 100_000 ? { input: 0.5, output: 2.5 } : { input: 0.1, output: 0.5 }
    case 'text-embedding-3-small':
      return { input: 0.02, output: 0 }
    default:
      throw createError({
        statusCode: 503,
        message: 'AI model pricing unavailable',
        data: { code: 'AI_PRICE_REQUIRED' },
      })
  }
}

export const aiTextCostMicros = (model: string, input: number, output: number) => {
  if (![input, output].every((value) => Number.isSafeInteger(value) && value >= 0))
    throw new RangeError('Invalid AI usage')
  const price = aiTextPrice(model, input)
  return Math.ceil(input * price.input + output * price.output)
}

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8')
const searchAllowance = (params: LanguageModelV4CallOptions) =>
  params.tools?.some((tool) => tool.type === 'provider' && /search/i.test(tool.id)) ? 100_000 : 0

const reserve = async (
  model: string,
  task: string,
  maximum: number,
  clientSiteId?: string,
  kind: 'BUDGET' | 'SEO' = 'BUDGET',
) =>
  reserveAiAllowance(aiSpendSiteId(clientSiteId), kind, Math.max(1, maximum), {
    model,
    task,
    priceVersion: AI_PRICE_VERSION,
    articleOperationId: spend.getStore()?.articleOperationId,
  })

const settle = async (reservation: Awaited<ReturnType<typeof reserveAiAllowance>>, amount: number | null) => {
  await settleAiAllowance(reservation, amount).catch((error) =>
    reportCaughtError('AI spend settlement failed', error, {
      clientSiteId: reservation.clientSiteId,
      reservationId: reservation.id,
    }),
  )
}

export { reserve as reserveAiSpend, settle as settleAiSpend }

const measured = (model: string, usage: LanguageModelV4Usage, toolCost: number) => {
  const input = usage.inputTokens.total
  const output = usage.outputTokens.total
  return input == null || output == null ? null : aiTextCostMicros(model, input, output) + toolCost
}

export const aiLanguageSpend = (task: string, model: string, clientSiteId?: string): LanguageModelMiddleware => ({
  transformParams: async ({ params }) => ({
    ...params,
    maxOutputTokens: params.maxOutputTokens ?? 32768,
    ...(searchAllowance(params) && model.startsWith('gpt-')
      ? {
          providerOptions: {
            ...params.providerOptions,
            openai: {
              ...params.providerOptions?.openai,
              maxToolCalls: Math.min(8, Number(params.providerOptions?.openai?.maxToolCalls) || 8),
            },
          },
        }
      : {}),
  }),
  async wrapGenerate({ doGenerate, params }) {
    const tools = searchAllowance(params)
    // Byte length is a conservative token upper bound; reserve search-result context separately.
    const input = bytes(params.prompt) + (tools ? 64_000 : 0)
    const reservation = await reserve(
      model,
      task,
      aiTextCostMicros(model, input, params.maxOutputTokens!) + tools,
      clientSiteId,
    )
    try {
      const result = await doGenerate()
      const searches = result.content.filter(
        (part) => part.type === 'tool-call' && /search/i.test(part.toolName),
      ).length
      await settle(reservation, measured(model, result.usage, searches * 10_000))
      return result
    } catch (error) {
      await settle(reservation, null)
      throw error
    }
  },
  async wrapStream({ doStream, params }) {
    const tools = searchAllowance(params)
    const input = bytes(params.prompt) + (tools ? 64_000 : 0)
    const reservation = await reserve(
      model,
      task,
      aiTextCostMicros(model, input, params.maxOutputTokens!) + tools,
      clientSiteId,
    )
    try {
      const result = await doStream()
      let finished = false
      let searches = 0
      return {
        ...result,
        stream: result.stream.pipeThrough(
          new TransformStream({
            async transform(part, controller) {
              if (part.type === 'tool-call' && /search/i.test(part.toolName)) searches++
              if (part.type === 'finish' && !finished) {
                finished = true
                await settle(reservation, measured(model, part.usage, searches * 10_000))
              }
              controller.enqueue(part)
            },
            async flush() {
              if (!finished) await settle(reservation, null)
            },
          }),
        ),
      }
    } catch (error) {
      await settle(reservation, null)
      throw error
    }
  },
})

export const aiImageSpend = (task: string, model: string): ImageModelMiddleware => ({
  async wrapGenerate({ doGenerate, params }) {
    if (model !== 'gpt-image-2.5-flare') throw new Error('Image pricing unavailable')
    // No high/auto quality or unbounded provider-default size in a funded request.
    if (params.providerOptions.openai?.quality !== 'medium' || params.size !== '1024x1024')
      throw new Error('Unsupported funded image configuration')
    const reservation = await reserve(model, task, params.n * 150_000 + bytes(params.prompt) * 5)
    try {
      const result = await doGenerate()
      const input = result.usage?.inputTokens
      const output = result.usage?.outputTokens
      await settle(reservation, input == null || output == null ? null : Math.ceil(input * 8 + output * 30))
      return result
    } catch (error) {
      await settle(reservation, null)
      throw error
    }
  },
})

export const aiEmbeddingSpend = (task: string, model: string, clientSiteId?: string): EmbeddingModelMiddleware => ({
  async wrapEmbed({ doEmbed, params }) {
    const reservation = await reserve(model, task, aiTextCostMicros(model, bytes(params.values), 0), clientSiteId)
    try {
      const result = await doEmbed()
      await settle(reservation, result.usage?.tokens == null ? null : aiTextCostMicros(model, result.usage.tokens, 0))
      return result
    } catch (error) {
      await settle(reservation, null)
      throw error
    }
  },
})
