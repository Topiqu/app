import { createOpenAI } from '@ai-sdk/openai'

const openAiClientSingleton = () => {
  const apiKey = useRuntimeConfig().openAi.apiKey

  return createOpenAI({ apiKey })
}

const appGlobal = globalThis as typeof globalThis & {
  openAiGlobal?: ReturnType<typeof openAiClientSingleton>
}

const openAi = appGlobal.openAiGlobal ?? openAiClientSingleton()

appGlobal.openAiGlobal = openAi

export default openAi
