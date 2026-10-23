import type { AsyncDataHandlerContext, NuxtApp } from '#app'

// Nuxt keeps inactive async-data records, including their handler closures. This
// module scope lets disposal release the component callback without mutating Nuxt's cache.
export function createAsyncDataRequest<T>(fetchData: (signal: AbortSignal) => Promise<T>) {
  let current: typeof fetchData | undefined = fetchData
  return {
    fetch: (_nuxtApp: NuxtApp, { signal }: AsyncDataHandlerContext) => {
      if (!current) return Promise.reject(new DOMException('Request scope disposed', 'AbortError'))
      return current(signal)
    },
    dispose: () => {
      current = undefined
    },
  }
}
