export type AiProvider = 'xai' | 'google'

export const AI_MODELS = {
  articleResearch: { provider: 'xai', id: 'grok-4.3' },
  articleWriter: { provider: 'google', id: 'gemini-3.1-pro-preview' },
  linkedinPost: { provider: 'google', id: 'gemini-3.1-pro-preview' },
  translation: { provider: 'xai', id: 'grok-4.3' },
  promptEnhance: { provider: 'xai', id: 'grok-4.3' },
  sentiment: { provider: 'xai', id: 'grok-4.3' },
  communityInsight: { provider: 'xai', id: 'grok-4.3' },
} as const satisfies Record<string, { provider: AiProvider; id: string }>

export const AI_IMAGE_MODELS = {
  articleImage: { provider: 'google', id: 'imagen-4.0-fast-generate-001' },
} as const satisfies Record<string, { provider: AiProvider; id: string }>

export type AiTask = keyof typeof AI_MODELS
export type AiImageTask = keyof typeof AI_IMAGE_MODELS

export const aiModelId = (task: AiTask): string => AI_MODELS[task].id

export const aiModelProvider = (task: AiTask): AiProvider => AI_MODELS[task].provider

export const aiImageModelId = (task: AiImageTask): string => AI_IMAGE_MODELS[task].id

export const aiImageModelProvider = (task: AiImageTask): AiProvider => AI_IMAGE_MODELS[task].provider
