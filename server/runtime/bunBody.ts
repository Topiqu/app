import { MULTIPART_BODY_MAX_BYTES, REQUEST_BODY_MAX_BYTES } from '../../shared/utils/requestLimits'

export class RequestBodyError extends Error {
  constructor(readonly status: 400 | 413) {
    super(status === 413 ? 'Payload Too Large' : 'Invalid request body')
    this.name = 'RequestBodyError'
  }
}

/** Count actual bytes before Nitro can parse a body or start privileged work. */
export async function readBunRequestBody(request: Request): Promise<ArrayBuffer | undefined> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  const limit = contentType === 'multipart/form-data' ? MULTIPART_BODY_MAX_BYTES : REQUEST_BODY_MAX_BYTES
  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > limit)) {
    // A rejected caller must not keep streaming a body after the response is chosen.
    void request.body?.cancel().catch(() => {})
    throw new RequestBodyError(/^\d+$/.test(declaredLength) ? 413 : 400)
  }
  if (!request.body) return undefined

  const reader = request.body.getReader()
  const abort = () => {
    // Cancellation closes outstanding reads before awaiting the stream's underlying
    // cancel callback. Never let a stalled cancellation prevent the HTTP response.
    void reader.cancel().catch(() => {})
  }
  request.signal.addEventListener('abort', abort, { once: true })
  let complete = false
  let total = 0
  let buffer = new Uint8Array(0)
  try {
    if (request.signal.aborted) throw new RequestBodyError(400)
    while (true) {
      const { done, value } = await reader.read()
      if (request.signal.aborted) throw new RequestBodyError(400)
      if (done) break
      if (value.byteLength > limit - total) throw new RequestBodyError(413)
      const size = total + value.byteLength
      if (size > buffer.byteLength) {
        // Growing one buffer also bounds memory for streams split into many tiny chunks.
        const expanded = new Uint8Array(Math.min(limit, Math.max(8192, buffer.byteLength * 2, size)))
        expanded.set(buffer)
        buffer = expanded
      }
      buffer.set(value, total)
      total = size
    }
    complete = true
    return total === buffer.byteLength ? buffer.buffer : buffer.buffer.slice(0, total)
  } finally {
    request.signal.removeEventListener('abort', abort)
    if (!complete) abort()
    reader.releaseLock()
  }
}
