import type { AiImageTask, AiProvider, AiTask } from './modelRegistry'

import openAi from './openai'
import { AI_IMAGE_MODELS, AI_MODELS } from './modelRegistry'

const TEXT_PROVIDERS: Record<AiProvider, (id: string) => ReturnType<typeof openAi>> = {
  openai: (id) => openAi(id),
}

const IMAGE_PROVIDERS: Record<AiProvider, (id: string) => ReturnType<typeof openAi.image>> = {
  openai: (id) => openAi.image(id),
}

export const aiModel = (task: AiTask) => {
  const { provider, id } = AI_MODELS[task]

  return TEXT_PROVIDERS[provider](id)
}

export const aiImageModel = (task: AiImageTask) => {
  const { provider, id } = AI_IMAGE_MODELS[task]

  return IMAGE_PROVIDERS[provider](id)
}

export const aiWebSearchTool = () => openAi.tools.webSearch({ searchContextSize: 'high' })
