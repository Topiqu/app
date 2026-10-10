import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai'

import type { AiEmbeddingTask, AiImageTask, AiTask } from './modelRegistry'

import openAi from './openai'
import anthropic from './anthropic'
import { aiEmbeddingModelId, aiImageModelId, aiModelId, aiModelProvider } from './modelRegistry'

// Haiku thinks out of the same `max_tokens` pool as the answer, so call-site budgets that size the
// answer alone end in `length` (research) or truncated JSON (writer). At $0.50/MTok this is pennies.
const THINKING_HEADROOM = 8000

const thinkingHeadroom: LanguageModelMiddleware = {
  transformParams: async ({ params }) => {
    const thinking = params.providerOptions?.anthropic?.thinking as { type?: string } | undefined
    return params.maxOutputTokens == null || thinking?.type === 'disabled'
      ? params
      : { ...params, maxOutputTokens: params.maxOutputTokens + THINKING_HEADROOM }
  },
}

export const aiModel = (task: AiTask) =>
  aiModelProvider(task) === 'anthropic'
    ? wrapLanguageModel({ model: anthropic(aiModelId(task)), middleware: thinkingHeadroom })
    : openAi.responses(aiModelId(task))

export const aiImageModel = (task: AiImageTask) => openAi.image(aiImageModelId(task))

export const aiEmbeddingModel = (task: AiEmbeddingTask) => openAi.embedding(aiEmbeddingModelId(task))

type SearchDepth = 'low' | 'medium' | 'high'

// Anthropic has no context-size knob; the number of searches is the nearest equivalent.
const SEARCH_USES = { low: 3, medium: 5, high: 8 } as const satisfies Record<SearchDepth, number>

/** The search tool has to come from the same provider as the task's model. */
export const aiWebSearchTool = (task: AiTask, depth: SearchDepth = 'high') =>
  aiModelProvider(task) === 'anthropic'
    ? anthropic.tools.webSearch_20250305({ maxUses: SEARCH_USES[depth] })
    : openAi.tools.webSearch({ searchContextSize: depth })
