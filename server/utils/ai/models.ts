import type { AiEmbeddingTask, AiImageTask, AiTask } from './modelRegistry'

import openAi from './openai'
import { aiEmbeddingModelId, aiImageModelId, aiModelId } from './modelRegistry'

export const aiModel = (task: AiTask) => openAi.responses(aiModelId(task))

export const aiImageModel = (task: AiImageTask) => openAi.image(aiImageModelId(task))

export const aiEmbeddingModel = (task: AiEmbeddingTask) => openAi.embedding(aiEmbeddingModelId(task))

export const aiWebSearchTool = (searchContextSize: 'low' | 'medium' | 'high' = 'high') =>
  openAi.tools.webSearch({ searchContextSize })
