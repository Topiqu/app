import type { H3Event } from 'h3'
import type { ZodType } from 'zod'

import { createError, getRequestWebStream } from 'h3'

/** Certificate material must be bounded even for chunked requests and absent Content-Length. */
export const readDomainBody = async <T>(event: H3Event, schema: ZodType<T>, maxBytes = 100000): Promise<T> => {
  const stream = getRequestWebStream(event)
  if (!stream) throw createError({ statusCode: 400, message: 'Request body required' })
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    void reader.cancel().catch(() => {})
  }, 10000)
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw createError({ statusCode: 413 })
      }
      chunks.push(value)
    }
    if (timedOut) throw createError({ statusCode: 408, message: 'Request body timeout' })
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    try {
      return schema.parse(JSON.parse(new TextDecoder().decode(body)))
    } catch {
      throw createError({ statusCode: 400, message: 'Invalid domain request', data: { code: 'invalid' } })
    }
  } finally {
    clearTimeout(timeout)
    reader.releaseLock()
  }
}
