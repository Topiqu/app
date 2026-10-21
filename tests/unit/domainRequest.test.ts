import type { H3Event } from 'h3'

import { z } from 'zod'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { readDomainBody } from '../../server/utils/domains/request'

const stream = vi.hoisted(() => vi.fn())
vi.mock('h3', async (original) => ({ ...(await original<typeof import('h3')>()), getRequestWebStream: stream }))

afterEach(() => vi.clearAllMocks())
const requestStream = (values: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const value of values) controller.enqueue(new TextEncoder().encode(value))
      controller.close()
    },
  })
describe('bounded domain request bodies', () => {
  it('reads chunked JSON with no Content-Length', async () => {
    stream.mockReturnValue(requestStream(['{"value":', '"fixture"}']))
    await expect(readDomainBody({} as H3Event, z.object({ value: z.string() }), 30)).resolves.toEqual({
      value: 'fixture',
    })
  })
  it('rejects oversized bodies even without a declared length', async () => {
    stream.mockReturnValue(requestStream(['x'.repeat(20), 'y'.repeat(20)]))
    await expect(readDomainBody({} as H3Event, z.object({}), 30)).rejects.toMatchObject({ statusCode: 413 })
  })
  it('does not reflect certificate material in validation errors', async () => {
    stream.mockReturnValue(requestStream(['{"value":"private-fixture"}']))
    await expect(readDomainBody({} as H3Event, z.object({ value: z.number() }))).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid domain request',
    })
  })
})
