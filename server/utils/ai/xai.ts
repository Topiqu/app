import { createXai } from '@ai-sdk/xai'

const xaiClientSingleton = () => {
  const apiKey = useRuntimeConfig().xai.apiKey

  return createXai({ apiKey })
}

declare const globalThis: {
  xaiGlobal: ReturnType<typeof xaiClientSingleton>
} & typeof global

const xai = globalThis.xaiGlobal ?? xaiClientSingleton()

globalThis.xaiGlobal = xai

export default xai
