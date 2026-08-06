export type AiProvider = 'openai'

export const AI_MODELS = {
  topicSelection: { provider: 'openai', id: 'gpt-5.6-luna' },
  articleResearch: { provider: 'openai', id: 'gpt-5.6-luna' },
  articleWriter: { provider: 'openai', id: 'gpt-5.6-luna' },
  linkedinPost: { provider: 'openai', id: 'gpt-5.6-luna' },
  translation: { provider: 'openai', id: 'gpt-5.6-luna' },
  promptEnhance: { provider: 'openai', id: 'gpt-5.6-luna' },
  sentiment: { provider: 'openai', id: 'gpt-5.6-luna' },
  communityInsight: { provider: 'openai', id: 'gpt-5.6-luna' },
} as const satisfies Record<string, { provider: AiProvider; id: string }>

export const AI_IMAGE_MODELS = {
  articleImage: { provider: 'openai', id: 'gpt-image-2' },
} as const satisfies Record<string, { provider: AiProvider; id: string }>

export type AiTask = keyof typeof AI_MODELS
export type AiImageTask = keyof typeof AI_IMAGE_MODELS

export const aiModelId = (task: AiTask): string => AI_MODELS[task].id

export const aiModelProvider = (task: AiTask): AiProvider => AI_MODELS[task].provider

export const aiImageModelId = (task: AiImageTask): string => AI_IMAGE_MODELS[task].id

export const aiImageModelProvider = (task: AiImageTask): AiProvider => AI_IMAGE_MODELS[task].provider
