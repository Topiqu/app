// @vitest-environment node

import sharp from 'sharp'
import { createError } from 'h3'
import { createHash } from 'node:crypto'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { analyze } = vi.hoisted(() => ({ analyze: vi.fn() }))
vi.mock('../../../server/utils/imageAnalysis', () => ({ analyzeImage: analyze, IMAGE_MODERATION_POLICY_VERSION: 1 }))
mockNuxtImport('useRuntimeConfig', () => () => ({ public: { cdnUrl: 'https://cdn.example.org/' } }))

const setup = async () => {
  vi.resetModules()
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'blue' } })
    .png()
    .toBuffer()
  const contentHash = createHash('sha256').update(bytes).digest('hex')
  const storageKey = 'uploads/tenant/11111111-1111-4111-8111-111111111111.webp'
  const asset = {
    id: 'asset',
    clientSiteId: 'tenant',
    contentHash,
    storageKey,
    url: `https://cdn.example.org/${storageKey}`,
    deliveryUrl: `https://cdn.example.org/${storageKey}`,
    archivedAt: null as Date | null,
    purgeAfter: null as Date | null,
    purgedAt: null as Date | null,
    deletedAt: null as Date | null,
    mimeType: 'image/webp',
    sizeBytes: 100,
    width: 8,
    height: 8,
    originalFilename: 'original.png',
    machineTags: ['Landscape'],
    updatedAt: new Date(),
    origin: 'LICENSED_STOCK',
    author: 'Original author',
    license: 'Reviewed license',
    rightsConfirmedAt: new Date('2026-01-01'),
    metadataSignals: {
      copyright: 'Original copyright',
      uploadModeration: {
        policyVersion: 1,
        moderation: 'clear',
        checkedAt: new Date().toISOString(),
        sourceHash: contentHash,
        storageKey,
      },
    } as Record<string, unknown>,
  }
  analyze.mockReset().mockResolvedValue({ tags: ['Landscape'], moderation: 'clear', modelVersion: 'offline-v1' })
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getSessionUser', async () => ({ id: 'author', role: 'admin', clientSiteId: 'tenant' }))
  vi.stubGlobal('requireTenantScope', async () => ({ membership: { clientSiteId: 'tenant' } }))
  vi.stubGlobal('consumeRateLimit', async () => true)
  vi.stubGlobal('readMultipartFormData', async () => [
    { name: 'file', filename: 'retry.png', type: 'image/png', data: bytes },
  ])
  vi.stubGlobal('hashMedia', (input: Uint8Array) => createHash('sha256').update(input).digest('hex'))
  const findFirst = vi.fn(async ({ where }) =>
    where.clientSiteId === asset.clientSiteId &&
    where.contentHash === asset.contentHash &&
    asset.purgedAt === null &&
    asset.deletedAt === null
      ? asset
      : null,
  )
  const update = vi.fn().mockResolvedValue({ count: 1 })
  vi.stubGlobal('prisma', { mediaAsset: { findFirst, updateMany: update } })
  vi.stubGlobal('getEnhancedPrisma', async () => ({ mediaAsset: { findFirst, update } }))
  const register = vi.fn(async (input: Record<string, unknown>) => {
    if (asset.clientSiteId === 'tenant' && !asset.purgedAt && !asset.deletedAt) return asset
    return { ...asset, ...input, id: 'new-tenant-asset', clientSiteId: 'tenant', purgedAt: null, deletedAt: null }
  })
  vi.stubGlobal('registerMediaAsset', register)
  const put = vi.fn(async (key: string) => `https://cdn.example.org/${key}`)
  vi.stubGlobal('putToCdn', put)
  const remove = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('deleteFromCdn', remove)
  vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
  const { default: handler } = await import('../../../server/api/upload')
  return { run: () => handler({} as never), asset, findFirst, update, register, put, remove }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('validated tenant upload reuse', () => {
  it('reuses current explicit moderation evidence without conversion, provider or storage work', async () => {
    const { run, asset, put, register } = await setup()
    const result = await run()
    expect(result).toMatchObject({
      reused: true,
      url: asset.url,
      mediaAsset: {
        origin: 'LICENSED_STOCK',
        author: 'Original author',
        license: 'Reviewed license',
        rightsConfirmedAt: asset.rightsConfirmedAt,
      },
    })
    expect(analyze).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
  })

  it('records new proof after revalidating a legacy asset without changing its rights', async () => {
    const { run, asset, update } = await setup()
    delete asset.metadataSignals.uploadModeration
    const result = await run()
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: asset.id, clientSiteId: 'tenant', contentHash: asset.contentHash }),
        data: {
          metadataSignals: expect.objectContaining({
            copyright: 'Original copyright',
            uploadModeration: expect.objectContaining({
              policyVersion: 1,
              moderation: 'clear',
              sourceHash: asset.contentHash,
              storageKey: asset.storageKey,
            }),
          }),
        },
      }),
    )
    expect(result.mediaAsset).toMatchObject({
      origin: 'LICENSED_STOCK',
      license: 'Reviewed license',
      rightsConfirmedAt: asset.rightsConfirmedAt,
    })
  })

  it.each([
    [
      'unavailable verdict',
      (asset: TestAsset) => {
        ;(asset.metadataSignals.uploadModeration as Record<string, unknown>).moderation = 'unavailable'
      },
    ],
    [
      'expired verdict',
      (asset: TestAsset) => {
        ;(asset.metadataSignals.uploadModeration as Record<string, unknown>).checkedAt = new Date(
          Date.now() - 86_400_001,
        ).toISOString()
      },
    ],
    [
      'future verdict',
      (asset: TestAsset) => {
        ;(asset.metadataSignals.uploadModeration as Record<string, unknown>).checkedAt = new Date(
          Date.now() + 60_000,
        ).toISOString()
      },
    ],
    [
      'old policy',
      (asset: TestAsset) => {
        ;(asset.metadataSignals.uploadModeration as Record<string, unknown>).policyVersion = 0
      },
    ],
    [
      'different bytes',
      (asset: TestAsset) => {
        ;(asset.metadataSignals.uploadModeration as Record<string, unknown>).sourceHash = '0'.repeat(64)
      },
    ],
    [
      'different stored object',
      (asset: TestAsset) => {
        ;(asset.metadataSignals.uploadModeration as Record<string, unknown>).storageKey =
          'uploads/tenant/different.webp'
      },
    ],
    [
      'archived asset',
      (asset: TestAsset) => {
        asset.archivedAt = new Date()
      },
    ],
    [
      'pending purge',
      (asset: TestAsset) => {
        asset.purgeAfter = new Date()
      },
    ],
    [
      'external delivery',
      (asset: TestAsset) => {
        asset.deliveryUrl = 'https://elsewhere.example.org/image.webp'
      },
    ],
    [
      'purged asset',
      (asset: TestAsset) => {
        asset.purgedAt = new Date()
      },
    ],
    [
      'deleted asset',
      (asset: TestAsset) => {
        asset.deletedAt = new Date()
      },
    ],
  ])('revalidates %s instead of trusting a byte hash alone', async (_name, alter) => {
    const { run, asset } = await setup()
    alter(asset)
    const result = await run()
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(result.mediaAsset?.clientSiteId).toBe('tenant')
  })

  it('returns the registered canonical object and cleans up a superseded upload after a concurrent reuse', async () => {
    const { run, asset, findFirst, put, remove } = await setup()
    findFirst.mockResolvedValue(null)
    const result = await run()
    expect(result).toMatchObject({ url: asset.url, optimizedUrl: asset.deliveryUrl, reused: true })
    expect(put).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith(put.mock.calls[0]?.[0], 'uploads/tenant/')
  })

  it('does not turn failed superseded-object cleanup into a failed completed upload', async () => {
    const { run, asset, findFirst, remove } = await setup()
    findFirst.mockResolvedValue(null)
    remove.mockRejectedValue(new Error('synthetic delete failure'))
    await expect(run()).resolves.toMatchObject({ url: asset.url, reused: true })
    expect(reportCaughtError).toHaveBeenCalledWith('Superseded upload cleanup failed', expect.any(Error), {
      clientSiteId: 'tenant',
    })
  })

  it('retains a new object when the registered canonical row uses it for delivery', async () => {
    const { run, asset, findFirst, register, remove } = await setup()
    findFirst.mockResolvedValue(null)
    register.mockImplementation(async (input) => ({ ...asset, deliveryUrl: String(input.url) }))
    const result = await run()
    expect(result.optimizedUrl).not.toBe(asset.url)
    expect(result.optimizedUrl).toBe(result.mediaAsset?.deliveryUrl)
    expect(remove).not.toHaveBeenCalled()
  })

  it('never reads an identical hash from another tenant', async () => {
    const { run, asset, findFirst } = await setup()
    asset.clientSiteId = 'other-tenant'
    const result = await run()
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clientSiteId: 'tenant' }) }),
    )
    expect(analyze).toHaveBeenCalledTimes(1)
    expect(result.mediaAsset?.clientSiteId).toBe('tenant')
  })

  it('does not turn an unavailable provider into a reusable clear proof', async () => {
    const { run, asset, update } = await setup()
    delete asset.metadataSignals.uploadModeration
    analyze.mockResolvedValue({ tags: [], moderation: 'unavailable' })
    await run()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          metadataSignals: expect.objectContaining({
            uploadModeration: expect.objectContaining({ moderation: 'unavailable' }),
          }),
        },
      }),
    )
  })

  it('does not overwrite concurrently changed metadata when saving evidence', async () => {
    const { run, asset, update } = await setup()
    delete asset.metadataSignals.uploadModeration
    update.mockResolvedValue({ count: 0 })
    const result = await run()
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ updatedAt: asset.updatedAt }) }),
    )
    expect(result.mediaAsset?.metadataSignals).not.toHaveProperty('uploadModeration')
  })
})

type TestAsset = Awaited<ReturnType<typeof setup>>['asset']
