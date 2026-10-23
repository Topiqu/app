// @vitest-environment node

import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { send, destroy, construct } = vi.hoisted(() => ({ send: vi.fn(), destroy: vi.fn(), construct: vi.fn() }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = send
    destroy = destroy
    constructor(config: unknown) {
      construct(config)
    }
  },
  PutObjectCommand: class {
    constructor(readonly input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(readonly input: unknown) {}
  },
}))
mockNuxtImport('useRuntimeConfig', () => () => ({
  awsRegion: 'us-east-1',
  awsAccessKeyId: 'offline',
  awsSecretAccessKey: 'offline',
  awsS3BucketName: 'offline-bucket',
  public: { cdnUrl: 'https://cdn.example.org' },
}))

beforeEach(() => {
  vi.resetModules()
  send.mockReset().mockResolvedValue({})
  destroy.mockReset()
  construct.mockReset()
})

describe('storage request resources', () => {
  it('disposes an upload client and gives the SDK a bounded abort signal', async () => {
    const { putToCdn } = await import('../../server/utils/storage')
    await expect(putToCdn('uploads/tenant/image.webp', new Uint8Array([1]), 'image/webp')).resolves.toBe(
      'https://cdn.example.org/uploads/tenant/image.webp',
    )
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[1]).toMatchObject({ abortSignal: expect.any(AbortSignal) })
    expect(construct).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 2 }))
  })

  it('disposes the upload client when its request rejects', async () => {
    send.mockRejectedValue(new Error('storage unavailable'))
    const { putToCdn } = await import('../../server/utils/storage')
    await expect(putToCdn('uploads/tenant/image.webp', new Uint8Array([1]), 'image/webp')).rejects.toThrow(
      'storage unavailable',
    )
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('keeps deletion inside the verified prefix and disposes its client', async () => {
    const { deleteFromCdn } = await import('../../server/utils/storage')
    await expect(deleteFromCdn('uploads/tenant/image.webp', 'avatars/')).rejects.toThrow('outside')
    expect(construct).not.toHaveBeenCalled()
    await deleteFromCdn('uploads/tenant/image.webp', 'uploads/tenant/')
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[1]).toMatchObject({ abortSignal: expect.any(AbortSignal) })
  })

  it('disposes a deletion client when its request rejects', async () => {
    send.mockRejectedValue(new Error('synthetic delete failure'))
    const { deleteFromCdn } = await import('../../server/utils/storage')
    await expect(deleteFromCdn('uploads/tenant/image.webp', 'uploads/tenant/')).rejects.toThrow(
      'synthetic delete failure',
    )
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
