import { lookup } from 'node:dns/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assertPublicHttpsUrl, fetchPublicUrl, readLimitedBody } from '../../../server/utils/images/publicFetch'

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }))
vi.mock('node:dns/promises', () => ({ default: { lookup: lookupMock }, lookup: lookupMock }))

describe('official media network guard', () => {
  beforeEach(() => vi.mocked(lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }]))
  afterEach(() => vi.unstubAllGlobals())

  it('accepts a public HTTPS domain', async () => {
    await expect(assertPublicHttpsUrl('https://media.example.org/press/image.jpg')).resolves.toMatchObject({
      hostname: 'media.example.org',
    })
  })

  it.each([
    'http://media.example.org/image.jpg',
    'https://localhost/image.jpg',
    'https://127.0.0.1/image.jpg',
    'https://metadata.internal/image.jpg',
    'https://user:password@media.example.org/image.jpg',
  ])('rejects unsafe target %s', async (url) => {
    await expect(assertPublicHttpsUrl(url)).rejects.toThrow()
  })

  it('rejects domains resolving to private space', async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: '169.254.169.254', family: 4 }])
    await expect(assertPublicHttpsUrl('https://media.example.org/image.jpg')).rejects.toThrow('non-public')
  })

  it('revalidates every redirect target before following it', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { location: 'https://cdn.example.org/a.jpg' } }),
        )
        .mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200 })),
    )
    await expect(fetchPublicUrl('https://press.example.org/asset')).resolves.toMatchObject({ status: 200 })
    expect(lookup).toHaveBeenCalledWith('press.example.org', { all: true })
    expect(lookup).toHaveBeenCalledWith('cdn.example.org', { all: true })
  })

  it('blocks a redirect when its destination resolves privately', async () => {
    vi.mocked(lookup)
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.0.0.1', family: 4 }])
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://private.example.org/a' } })),
    )
    await expect(fetchPublicUrl('https://press.example.org/asset')).rejects.toThrow('non-public')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('stops streaming bodies above the byte limit', async () => {
    const response = new Response(new Uint8Array(12))
    await expect(readLimitedBody(response, 10)).rejects.toThrow('too large')
  })
})
