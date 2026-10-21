import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cloudflareDomain,
  cloudflareValidationRecords,
  domainProviderConfig,
  dokployRequest,
  findDokployDomain,
} from '../../server/utils/domains/providers'

beforeEach(() => {
  vi.stubEnv('CLOUDFLARE_API_TOKEN', 'synthetic-cloudflare-token')
  vi.stubEnv('CLOUDFLARE_ZONE_ID', 'a'.repeat(32))
  vi.stubEnv('CLOUDFLARE_FALLBACK_ORIGIN', 'origin.example.com')
  vi.stubEnv('DOKPLOY_API_KEY', 'synthetic-dokploy-token')
  vi.stubEnv('DOKPLOY_APPLICATION_ID', 'fixture-app')
  vi.stubEnv('DOKPLOY_ORGANIZATION_ID', 'fixture-org')
  vi.stubEnv('DOKPLOY_BASE_URL', 'https://panel.example.com')
  vi.stubEnv('DOKPLOY_APPLICATION_PORT', '3000')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('domain provider boundaries', () => {
  it.each([
    'http://panel.example.com',
    'https://user:password@panel.example.com',
    'https://panel.example.com/api',
    'https://panel.example.com?token=secret',
  ])('rejects an unsafe or ambiguous panel base URL', (url) => {
    vi.stubEnv('DOKPLOY_BASE_URL', url)
    expect(domainProviderConfig).toThrow('CONFIGURATION')
  })
  it('never reflects provider errors containing credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('synthetic-cloudflare-token privateKey=secret')))
    await expect(cloudflareDomain('POST', undefined, 'blog.example.com')).rejects.toMatchObject({
      message: 'CLOUDFLARE_UNAVAILABLE',
    })
    await expect(dokployRequest('domain.create', 'POST', {})).rejects.toMatchObject({ message: 'DOKPLOY_UNAVAILABLE' })
  })
  it('does not follow redirects with authorization headers', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', fetch)
    await expect(cloudflareDomain('GET', undefined, 'blog.example.com')).rejects.toThrow()
    expect(fetch.mock.calls[0]![1]).toMatchObject({ redirect: 'error' })
  })
  it('requires an exact hostname when searching Cloudflare', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                hostname: 'other.example.com',
                status: 'active',
                ssl: { status: 'active' },
              },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    await expect(cloudflareDomain('GET', undefined, 'blog.example.com')).resolves.toBeNull()
  })
  it('refuses a router for another application or port', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              domainId: 'fixture-router',
              host: 'blog.example.com',
              applicationId: 'another-app',
              port: 3000,
              path: '/',
            },
          ]),
          { headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    await expect(findDokployDomain('blog.example.com')).rejects.toThrow('PROVIDER_CONFLICT')
  })
  it('returns only DNS validation records, never HTTP tokens or arbitrary provider fields', () => {
    expect(
      cloudflareValidationRecords({
        id: 'id',
        hostname: 'blog.example.com',
        status: 'pending',
        ownership_verification: { type: 'txt', name: '_cf.example.com', value: 'fixture' },
        ssl: { validation_records: [{ txt_name: '_acme.example.com', txt_value: 'certificate-fixture' }] },
      }),
    ).toEqual([
      { type: 'TXT', name: '_cf.example.com', value: 'fixture' },
      { type: 'TXT', name: '_acme.example.com', value: 'certificate-fixture' },
    ])
  })
})
