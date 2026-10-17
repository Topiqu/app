import { createAnthropic } from '@ai-sdk/anthropic'

const anthropicClientSingleton = () => {
  // Allow the SDK to read ANTHROPIC_API_KEY at runtime when the build had no key.
  const apiKey = useRuntimeConfig().anthropic.apiKey?.trim() || undefined

  return createAnthropic({ apiKey })
}

declare const globalThis: {
  anthropicGlobal: ReturnType<typeof anthropicClientSingleton>
} & typeof global

const anthropic = globalThis.anthropicGlobal ?? anthropicClientSingleton()

globalThis.anthropicGlobal = anthropic

export default anthropic
