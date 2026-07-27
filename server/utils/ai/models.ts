import type { AiImageTask, AiProvider, AiTask } from './modelRegistry'

import xai from './xai'
import googleAi from './googleAi'
import { AI_IMAGE_MODELS, AI_MODELS } from './modelRegistry'

const TEXT_PROVIDERS: Record<AiProvider, (id: string) => ReturnType<typeof xai>> = {
  xai: (id) => xai(id),
  google: (id) => googleAi(id),
}

const IMAGE_PROVIDERS: Record<AiProvider, (id: string) => ReturnType<typeof xai.image>> = {
  xai: (id) => xai.image(id),
  google: (id) => googleAi.image(id),
}

export const aiModel = (task: AiTask) => {
  const { provider, id } = AI_MODELS[task]

  return TEXT_PROVIDERS[provider](id)
}

export const aiImageModel = (task: AiImageTask) => {
  const { provider, id } = AI_IMAGE_MODELS[task]

  return IMAGE_PROVIDERS[provider](id)
}
