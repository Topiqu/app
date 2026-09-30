// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { shopifyTokenRequest } from '../../../server/utils/shopify/api'
import { shopifyAccessToken } from '../../../server/utils/shopify/token'
import { encryptShopifyToken } from '../../../server/utils/shopify/security'

vi.mock('../../../server/utils/shopify/api', async (original) => ({
  ...(await original<typeof import('../../../server/utils/shopify/api')>()),
  shopifyTokenRequest: vi.fn(),
}))

describe('Shopify expiring offline token rotation', () => {
  let row: Record<string, any>
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SHOPIFY_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'))
    row = {
      shop: 'store.myshopify.com',
      status: 'CONNECTED',
      encryptedAccessToken: encryptShopifyToken('access'),
      encryptedRefreshToken: encryptShopifyToken('refresh'),
      accessTokenExpiresAt: new Date(Date.now() - 1),
      refreshTokenExpiresAt: new Date(Date.now() + 86400_000),
      refreshLease: null,
      refreshLeaseUntil: null,
    }
    vi.stubGlobal('prisma', {
      shopifyConnection: {
        findUnique: vi.fn(async () => structuredClone(row)),
        updateMany: vi.fn(async ({ where, data }) => {
          if (
            (where.status && where.status !== row.status) ||
            (where.refreshLease && where.refreshLease !== row.refreshLease)
          )
            return { count: 0 }
          if (where.OR && row.refreshLeaseUntil && row.refreshLeaseUntil > new Date()) return { count: 0 }
          Object.assign(row, data)
          return { count: 1 }
        }),
      },
    })
    vi.mocked(shopifyTokenRequest).mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      refresh_token_expires_in: 86400,
      scope: 'write_content',
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns a valid access token without refreshing', async () => {
    row.accessTokenExpiresAt = new Date(Date.now() + 3600_000)
    expect(await shopifyAccessToken('connection-1')).toBe('access')
    expect(shopifyTokenRequest).not.toHaveBeenCalled()
  })

  it('serializes concurrent rotation so a refresh token is only used once', async () => {
    const results = await Promise.allSettled([shopifyAccessToken('connection-1'), shopifyAccessToken('connection-1')])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(shopifyTokenRequest).toHaveBeenCalledTimes(1)
    expect(row.refreshLease).toBeNull()
    expect(await shopifyAccessToken('connection-1')).toBe('new-access')
  })

  it('requires reconnect after an ambiguous refresh error or expired refresh token', async () => {
    vi.mocked(shopifyTokenRequest).mockRejectedValue(new Error('timeout'))
    await expect(shopifyAccessToken('connection-1')).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' })
    expect(row.status).toBe('REAUTH_REQUIRED')
    row.status = 'CONNECTED'
    row.refreshTokenExpiresAt = new Date(Date.now() - 1)
    await expect(shopifyAccessToken('connection-1')).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' })
    expect(shopifyTokenRequest).toHaveBeenCalledTimes(1)
  })

  it('does not reuse a refresh token after a crashed rotation worker', async () => {
    row.refreshLease = 'old-worker'
    row.refreshLeaseUntil = new Date(Date.now() - 1)
    await expect(shopifyAccessToken('connection-1')).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' })
    expect(shopifyTokenRequest).not.toHaveBeenCalled()
  })

  it('does not restore access if the store was disconnected during refresh', async () => {
    vi.mocked(shopifyTokenRequest).mockImplementation(async () => {
      row.status = 'REVOKED'
      row.encryptedAccessToken = null
      return {
        access_token: 'new',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        refresh_token_expires_in: 86400,
        scope: 'write_content',
      }
    })
    await expect(shopifyAccessToken('connection-1')).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' })
    expect(row.status).toBe('REVOKED')
    expect(row.encryptedAccessToken).toBeNull()
  })
})
