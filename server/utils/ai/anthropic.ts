import { createAnthropic } from '@ai-sdk/anthropic'

const anthropicClientSingleton = () => {
  // Allow the SDK to read ANTHROPIC_API_KEY at runtime when the build had no key.
  const apiKey = useRuntimeConfig().anthropic.apiKey?.trim() || undefined

  return createAnthropic({ apiKey })
}

const appGlobal = globalThis as typeof globalThis & {
  anthropicGlobal?: ReturnType<typeof anthropicClientSingleton>
}

const anthropic = appGlobal.anthropicGlobal ?? anthropicClientSingleton()

appGlobal.anthropicGlobal = anthropic

export default anthropic
