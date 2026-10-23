declare module '#topiqu-og-fetch-upstream' {
  export function guardedFetch(
    url: string,
    options: {
      headers?: Record<string, string>
      signal: AbortSignal
      isBlockedAddress?: (address: string) => boolean
    },
  ): Promise<Response>
}
