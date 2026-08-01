import { createOpenAI } from '@ai-sdk/openai'

const openAiClientSingleton = () => {
  const apiKey = useRuntimeConfig().openAi.apiKey

  return createOpenAI({ apiKey })
}

declare const globalThis: {
  openAiGlobal: ReturnType<typeof openAiClientSingleton>
} & typeof global

const openAi = globalThis.openAiGlobal ?? openAiClientSingleton()

globalThis.openAiGlobal = openAi

export default openAi
