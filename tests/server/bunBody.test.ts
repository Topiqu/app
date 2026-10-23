// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { KNOWLEDGE_LIMITS } from '../../shared/utils/knowledge'
import { readBunRequestBody } from '../../server/runtime/bunBody'
import { MULTIPART_BODY_MAX_BYTES, REQUEST_BODY_MAX_BYTES } from '../../shared/utils/requestLimits'
import {
  AVATAR_MAX_UPLOAD_BYTES,
  EMOJI_MAX_UPLOAD_BYTES,
  FONT_MAX_UPLOAD_BYTES,
  IMAGE_MAX_UPLOAD_BYTES,
} from '../../shared/utils/uploadLimits'

const request = (
  body: ReadableStream<Uint8Array> | Uint8Array,
  options: { method?: string; headers?: HeadersInit; signal?: AbortSignal } = {},
) =>
  new Request('http://localhost/fixture', {
    method: options.method ?? 'POST',
    body,
    duplex: 'half',
    headers: options.headers,
    signal: options.signal,
  } as RequestInit)

describe('bounded native request bodies', () => {
  it('preserves bytes exactly, including signed webhook payloads and tiny chunks', async () => {
    const bytes = new TextEncoder().encode(' { "signed": "Příliš žluťoučký\n" } ')
    let index = 0
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (index === bytes.length) controller.close()
          else controller.enqueue(bytes.subarray(index, ++index))
        },
      },
      { highWaterMark: 0 },
    )
    const input = request(body)
    expect(new Uint8Array((await readBunRequestBody(input))!)).toEqual(bytes)
    expect(input.body!.locked).toBe(false)
    expect(await readBunRequestBody(new Request('http://localhost/no-body'))).toBeUndefined()
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'rejects an oversized %s stream with no length header',
    async (method) => {
      const cancel = vi.fn()
      let pulls = 0
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulls++
            controller.enqueue(new Uint8Array(pulls === 1 ? REQUEST_BODY_MAX_BYTES : 1))
          },
          cancel,
        },
        { highWaterMark: 0 },
      )
      const input = request(body, { method })
      await expect(readBunRequestBody(input)).rejects.toMatchObject({ status: 413 })
      expect(pulls).toBe(2)
      expect(cancel).toHaveBeenCalledOnce()
      expect(input.body!.locked).toBe(false)
    },
  )

  it.each(['0', '1'])('counts actual bytes when declared content-length lies as %s', async (length) => {
    const input = request(new Uint8Array(REQUEST_BODY_MAX_BYTES + 1), {
      headers: { 'content-length': length },
    })
    await expect(readBunRequestBody(input)).rejects.toMatchObject({ status: 413 })
  })

  it('rejects an oversized declared length without requesting a body chunk', async () => {
    const pull = vi.fn()
    const cancel = vi.fn()
    const input = request(new ReadableStream({ pull, cancel }, { highWaterMark: 0 }), {
      headers: { 'content-length': String(REQUEST_BODY_MAX_BYTES + 1) },
    })
    await expect(readBunRequestBody(input)).rejects.toMatchObject({ status: 413 })
    expect(pull).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledOnce()
  })

  it.each(['-1', '1,2', '1e6', 'not-a-number'])('refuses malformed content-length %s', async (length) => {
    const input = request(new Uint8Array(1), { headers: { 'content-length': length } })
    await expect(readBunRequestBody(input)).rejects.toMatchObject({ status: 400 })
  })

  it('allows the exact JSON ceiling and every specialized file budget plus an envelope', async () => {
    expect((await readBunRequestBody(request(new Uint8Array(REQUEST_BODY_MAX_BYTES))))!.byteLength).toBe(
      REQUEST_BODY_MAX_BYTES,
    )
    for (const bytes of [
      IMAGE_MAX_UPLOAD_BYTES,
      AVATAR_MAX_UPLOAD_BYTES,
      EMOJI_MAX_UPLOAD_BYTES,
      FONT_MAX_UPLOAD_BYTES,
      KNOWLEDGE_LIMITS.maxFileBytes,
    ])
      expect(MULTIPART_BODY_MAX_BYTES).toBeGreaterThan(bytes + 64 * 1024)
    const bytes = new Uint8Array(IMAGE_MAX_UPLOAD_BYTES + 64 * 1024)
    expect(
      (await readBunRequestBody(request(bytes, { headers: { 'content-type': 'Multipart/Form-Data; boundary=x' } })))!
        .byteLength,
    ).toBe(bytes.byteLength)
  })

  it('bounds the whole multipart body independently of its file parser', async () => {
    const input = request(new Uint8Array(MULTIPART_BODY_MAX_BYTES + 1), {
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
    })
    await expect(readBunRequestBody(input)).rejects.toMatchObject({ status: 413 })
    expect(input.body!.locked).toBe(false)
  })

  it('aborts an outstanding read even if underlying cancellation never settles', async () => {
    const controller = new AbortController()
    const cancel = vi.fn(() => new Promise<void>(() => {}))
    const input = request(new ReadableStream({ cancel }, { highWaterMark: 0 }), { signal: controller.signal })
    const remove = vi.spyOn(input.signal, 'removeEventListener')
    const reading = readBunRequestBody(input)
    controller.abort()
    await expect(reading).rejects.toMatchObject({ status: 400 })
    expect(cancel).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(input.body!.locked).toBe(false)
  })

  it('does not read an already aborted body and removes its listener', async () => {
    const controller = new AbortController()
    controller.abort()
    const pull = vi.fn()
    const cancel = vi.fn()
    const input = request(new ReadableStream({ pull, cancel }, { highWaterMark: 0 }), { signal: controller.signal })
    await expect(readBunRequestBody(input)).rejects.toMatchObject({ status: 400 })
    expect(pull).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledOnce()
    expect(input.body!.locked).toBe(false)
  })

  it('releases its reader and abort listener on input failure', async () => {
    const failure = new Error('Synthetic input failure')
    const input = request(
      new ReadableStream({
        pull(controller) {
          controller.error(failure)
        },
      }),
    )
    const remove = vi.spyOn(input.signal, 'removeEventListener')
    await expect(readBunRequestBody(input)).rejects.toBe(failure)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(input.body!.locked).toBe(false)
  })
})
