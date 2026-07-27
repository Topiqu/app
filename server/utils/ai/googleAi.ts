import { createGoogle } from '@ai-sdk/google'

const googleAiClientSingleton = () => {
  const apiKey = useRuntimeConfig().googleAi.apiKey

  return createGoogle({ apiKey })
}

declare const globalThis: {
  googleAiGlobal: ReturnType<typeof googleAiClientSingleton>
} & typeof global

const googleAi = globalThis.googleAiGlobal ?? googleAiClientSingleton()

globalThis.googleAiGlobal = googleAi

export default googleAi
