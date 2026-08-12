import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  linkedinCompany: {
    update: vi.fn(async () => ({})),
  },
}

const refreshAccessToken = vi.fn()

vi.mock('../../../server/utils/prisma', () => ({ default: prismaMock }))
vi.mock('../../../server/utils/linkedin/api', () => ({ refreshAccessToken }))

const { getValidAccessToken } = await import('../../../server/utils/linkedin/token')

const base = {
  id: 'company-1',
  type: 'personal',
  accessToken: 'current-token',
  refreshToken: 'refresh-token',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('LINKEDIN_CLIENT_ID_PERSONAL', 'cid')
  vi.stubEnv('LINKEDIN_CLIENT_SECRET_PERSONAL', 'secret')
})

describe('getValidAccessToken', () => {
  it('returns the existing token when it is comfortably in the future', async () => {
    const token = await getValidAccessToken({
      ...base,
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    expect(token).toBe('current-token')
    expect(refreshAccessToken).not.toHaveBeenCalled()
    expect(prismaMock.linkedinCompany.update).not.toHaveBeenCalled()
  })

  it('refreshes and persists when the token is expired', async () => {
    refreshAccessToken.mockResolvedValue({
      access_token: 'new-token',
      refresh_token: 'new-refresh',
      expires_in: 5184000,
    })

    const token = await getValidAccessToken({
      ...base,
      tokenExpiresAt: new Date(Date.now() - 1000),
    })

    expect(token).toBe('new-token')
    expect(refreshAccessToken).toHaveBeenCalledWith('refresh-token', 'cid', 'secret')
    expect(prismaMock.linkedinCompany.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'company-1' },
        data: expect.objectContaining({ accessToken: 'new-token', refreshToken: 'new-refresh' }),
      }),
    )
  })

  it('refreshes within the 5-minute expiry buffer', async () => {
    refreshAccessToken.mockResolvedValue({ access_token: 'new-token', expires_in: 5184000 })

    const token = await getValidAccessToken({
      ...base,
      tokenExpiresAt: new Date(Date.now() + 60 * 1000),
    })

    expect(token).toBe('new-token')
    expect(refreshAccessToken).toHaveBeenCalledOnce()
  })

  it('keeps the old refresh token when LinkedIn omits a new one', async () => {
    refreshAccessToken.mockResolvedValue({ access_token: 'new-token', expires_in: 5184000 })

    await getValidAccessToken({ ...base, tokenExpiresAt: new Date(Date.now() - 1000) })

    expect(prismaMock.linkedinCompany.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refreshToken: 'refresh-token' }),
      }),
    )
  })

  it('does not attempt a refresh when there is no refresh token', async () => {
    const token = await getValidAccessToken({
      ...base,
      refreshToken: null,
      tokenExpiresAt: new Date(Date.now() - 1000),
    })

    expect(token).toBe('current-token')
    expect(refreshAccessToken).not.toHaveBeenCalled()
  })

  it('throws when there is no access token at all', async () => {
    await expect(getValidAccessToken({ ...base, accessToken: null, tokenExpiresAt: null })).rejects.toThrow(
      'No LinkedIn access token',
    )
  })
})
