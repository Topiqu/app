import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai'

import type { AiEmbeddingTask, AiImageTask, AiProvider, AiTask } from './modelRegistry'

import openAi from './openai'
import anthropic from './anthropic'
import { aiEmbeddingModelId, aiImageModelId, aiModelId, aiModelProvider } from './modelRegistry'

// Both providers count reasoning against the output limit. Call-site budgets size the answer;
// reserve additional space for thinking, with more headroom at high effort.
const THINKING_HEADROOM = { medium: 8000, high: 16000 } as const

const thinkingHeadroom = (provider: AiProvider): LanguageModelMiddleware => ({
  transformParams: async ({ params }) => {
    const options = params.providerOptions?.[provider]
    const thinking = options?.thinking as { type?: string } | undefined
    const effort = provider === 'anthropic' ? options?.effort : options?.reasoningEffort
    return params.maxOutputTokens == null || thinking?.type === 'disabled' || effort === 'none'
      ? params
      : {
          ...params,
          maxOutputTokens: params.maxOutputTokens + THINKING_HEADROOM[effort === 'high' ? 'high' : 'medium'],
        }
  },
})

export const aiModel = (task: AiTask) => {
  const provider = aiModelProvider(task)
  return wrapLanguageModel({
    model: provider === 'anthropic' ? anthropic(aiModelId(task)) : openAi.responses(aiModelId(task)),
    middleware: thinkingHeadroom(provider),
  })
}

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
