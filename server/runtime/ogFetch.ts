import { guardedFetch as upstreamGuardedFetch } from '#topiqu-og-fetch-upstream'

import { IMAGE_MAX_UPLOAD_BYTES } from '../../shared/utils/uploadLimits'

/** Bound OG resource bytes without replacing the module's DNS/socket security. */
export async function guardedFetch(...args: Parameters<typeof upstreamGuardedFetch>): Promise<Response> {
  const response = await upstreamGuardedFetch(...args)
  // The upstream redirect/error path cancels these responses without reading them.
  if (!response.ok || !response.body) return response
  if (Number(response.headers.get('content-length')) > IMAGE_MAX_UPLOAD_BYTES) {
    void response.body.cancel().catch(() => {})
    throw new Error('OG_IMAGE_RESPONSE_TOO_LARGE')
  }
  let total = 0
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (chunk.byteLength > IMAGE_MAX_UPLOAD_BYTES - total) throw new Error('OG_IMAGE_RESPONSE_TOO_LARGE')
        total += chunk.byteLength
        controller.enqueue(chunk)
      },
    }),
  )
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}
