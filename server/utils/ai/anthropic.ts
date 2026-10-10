import { createAnthropic } from '@ai-sdk/anthropic'

const anthropicClientSingleton = () => {
  const apiKey = useRuntimeConfig().anthropic.apiKey

  return createAnthropic({ apiKey })
}

declare const globalThis: {
  anthropicGlobal: ReturnType<typeof anthropicClientSingleton>
} & typeof global

const anthropic = globalThis.anthropicGlobal ?? anthropicClientSingleton()

globalThis.anthropicGlobal = anthropic

export default anthropic
