import { afterEach, describe, expect, it, vi } from 'vitest'

import { domainProbeSignature, probeDomainRouting } from '../../server/utils/domains/probe'

const request = vi.hoisted(() => vi.fn())
vi.mock('../../server/utils/images/publicFetch', () => ({
  postPublicUrl: request,
  readLimitedBody: async (response: Response) => new Uint8Array(await response.arrayBuffer()),
}))

afterEach(() => vi.clearAllMocks())
describe('routing proof', () => {
  it('binds signatures to both the hostname and nonce', () => {
    const a = domainProbeSignature('fixture-secret', 'blog.example.com', 'nonce-a')
    expect(a).not.toBe(domainProbeSignature('fixture-secret', 'other.example.com', 'nonce-a'))
    expect(a).not.toBe(domainProbeSignature('fixture-secret', 'blog.example.com', 'nonce-b'))
  })
  it('accepts a nonce-bound signature returned over the pinned HTTPS fetch', async () => {
    request.mockImplementation(async (_url, body: string) => {
      const { nonce } = JSON.parse(body) as { nonce: string }
      return new Response(
        JSON.stringify({ signature: domainProbeSignature('fixture-secret', 'blog.example.com', nonce) }),
      )
    })
    await expect(probeDomainRouting('blog.example.com', 'fixture-secret')).resolves.toBe(true)
  })
  it('rejects stale signatures and redirected/failed endpoints', async () => {
    request.mockResolvedValueOnce(new Response(JSON.stringify({ signature: '0'.repeat(64) })))
    await expect(probeDomainRouting('blog.example.com', 'fixture-secret')).resolves.toBe(false)
    request.mockResolvedValueOnce(new Response(null, { status: 302 }))
    await expect(probeDomainRouting('blog.example.com', 'fixture-secret')).resolves.toBe(false)
  })
})
