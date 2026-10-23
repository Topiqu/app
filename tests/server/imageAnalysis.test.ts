// @vitest-environment node

import { createError } from 'h3'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { send, destroy } = vi.hoisted(() => ({ send: vi.fn(), destroy: vi.fn() }))
vi.mock('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: class {
    send = send
    destroy = destroy
  },
  DetectLabelsCommand: class {
    constructor(readonly input: unknown) {}
  },
  DetectModerationLabelsCommand: class {
    constructor(readonly input: unknown) {}
  },
}))
mockNuxtImport('useRuntimeConfig', () => () => ({
  awsRegion: 'us-east-1',
  awsAccessKeyId: 'offline',
  awsSecretAccessKey: 'offline',
}))
beforeEach(() => {
  vi.resetModules()
  send.mockReset()
  destroy.mockReset()
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('image analysis evidence', () => {
  it('distinguishes an explicit clear verdict from missing tags and disposes its client', async () => {
    send
      .mockResolvedValueOnce({ ModerationLabels: [], ModerationModelVersion: 'offline-v1' })
      .mockResolvedValueOnce({ Labels: [] })
    const { analyzeImage } = await import('../../server/utils/imageAnalysis')
    await expect(analyzeImage(new Uint8Array([1]))).resolves.toMatchObject({
      tags: [],
      moderation: 'clear',
      modelVersion: 'offline-v1',
    })
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[1]).toMatchObject({ abortSignal: expect.any(AbortSignal) })
  })

  it('keeps the existing fail-open behavior without manufacturing reusable moderation proof', async () => {
    send
      .mockRejectedValueOnce(new Error('synthetic provider failure'))
      .mockResolvedValueOnce({ Labels: [{ Name: 'Landscape' }] })
    const { analyzeImage } = await import('../../server/utils/imageAnalysis')
    await expect(analyzeImage(new Uint8Array([1]))).resolves.toMatchObject({
      tags: ['Landscape'],
      moderation: 'unavailable',
    })
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('rejects a provider NSFW verdict and disposes its client without requesting tags', async () => {
    send.mockResolvedValueOnce({ ModerationLabels: [{ Name: 'Explicit Nudity' }] })
    const { analyzeImage } = await import('../../server/utils/imageAnalysis')
    await expect(analyzeImage(new Uint8Array([1]))).rejects.toMatchObject({ statusCode: 422 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('keeps clear moderation evidence when optional labeling fails', async () => {
    send.mockResolvedValueOnce({ ModerationLabels: [] }).mockRejectedValueOnce(new Error('labeling unavailable'))
    const { analyzeImage } = await import('../../server/utils/imageAnalysis')
    await expect(analyzeImage(new Uint8Array([1]))).resolves.toMatchObject({ tags: [], moderation: 'clear' })
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})

describe('avatar moderation resources', () => {
  it('bounds the request and disposes the client after an explicit clear verdict', async () => {
    send.mockResolvedValue({ ModerationLabels: [] })
    const { moderateAvatar } = await import('../../server/utils/avatar')
    await expect(moderateAvatar(new Uint8Array([1]))).resolves.toBeUndefined()
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[1]).toMatchObject({ abortSignal: expect.any(AbortSignal) })
  })

  it('preserves the fail-open provider outage behavior and disposes its client', async () => {
    send.mockRejectedValue(new Error('synthetic provider outage'))
    const { moderateAvatar } = await import('../../server/utils/avatar')
    await expect(moderateAvatar(new Uint8Array([1]))).resolves.toBeUndefined()
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(reportCaughtError).toHaveBeenCalledWith('Avatar moderation unavailable', expect.any(Error))
  })

  it('propagates its blocked verdict and disposes its client', async () => {
    send.mockResolvedValue({ ModerationLabels: [{ Name: 'Explicit Nudity' }] })
    const { moderateAvatar } = await import('../../server/utils/avatar')
    await expect(moderateAvatar(new Uint8Array([1]))).rejects.toMatchObject({ statusCode: 422 })
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(reportCaughtError).not.toHaveBeenCalled()
  })
})
