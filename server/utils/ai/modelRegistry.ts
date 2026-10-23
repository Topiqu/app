import type { AiVisibilityProvider } from '~~/generated/zenstack/models'

export type AiProvider = 'openai' | 'anthropic'

const HAIKU = { provider: 'anthropic', id: 'claude-haiku-5-5' } as const
const LUNA = { provider: 'openai', id: 'gpt-6-luna' } as const

export const AI_MODELS = {
  topicSelection: HAIKU,
  articleResearch: HAIKU,
  articleWriter: LUNA,
  articleEditor: HAIKU,
  imageCheck: HAIKU,
  linkedinPost: LUNA,
  translation: LUNA,
  promptEnhance: LUNA,
  textEdit: LUNA,
  sentiment: HAIKU,
  communityInsight: HAIKU,
  // Measures what ChatGPT answers, so it has to stay on an OpenAI model.
  visibility: LUNA,
  visibilityPrompts: HAIKU,
  factCheck: HAIKU,
  knowledgeSelect: HAIKU,
  websiteImport: HAIKU,
  articleLinks: HAIKU,
  keywordSeeds: HAIKU,
  topicScope: HAIKU,
  keywordOpportunity: HAIKU,
  backlinkMatch: HAIKU,
  backlinkOutreach: LUNA,
} as const satisfies Record<string, { provider: AiProvider; id: string }>

export const AI_VISIBILITY_MODELS = {
  ANTHROPIC: HAIKU.id,
  GOOGLE: 'gemini-3.8-flash',
  META: 'muse-spark-1.3',
  MISTRAL: 'mistral-medium-latest',
  OPENAI: AI_MODELS.visibility.id,
  XAI: 'grok-4.6',
} as const satisfies Record<AiVisibilityProvider, string>

export const AI_IMAGE_MODELS = {
  articleImage: { provider: 'openai', id: 'gpt-image-2.5-flare' },
} as const satisfies Record<string, { provider: AiProvider; id: string }>

// `dimensions` is baked into the `vector(1536)` column: another size needs a migration and a reindex.
export const AI_EMBEDDING_MODELS = {
  knowledge: { provider: 'openai', id: 'text-embedding-3-small', dimensions: 1536 },
} as const satisfies Record<string, { provider: AiProvider; id: string; dimensions: number }>

export type AiTask = keyof typeof AI_MODELS
export type AiImageTask = keyof typeof AI_IMAGE_MODELS
export type AiEmbeddingTask = keyof typeof AI_EMBEDDING_MODELS

export const aiModelId = (task: AiTask): string => AI_MODELS[task].id

export const aiModelProvider = (task: AiTask): AiProvider => AI_MODELS[task].provider

export const aiImageModelId = (task: AiImageTask): string => AI_IMAGE_MODELS[task].id

export const aiImageModelProvider = (task: AiImageTask): AiProvider => AI_IMAGE_MODELS[task].provider

export const aiEmbeddingModelId = (task: AiEmbeddingTask): string => AI_EMBEDDING_MODELS[task].id
