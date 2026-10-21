import { createError, getRequestHeader, getRequestURL } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authReturnPath,
  authTransferHash,
  consumeAuthTransfer,
  loadAuthTransfer,
  requireSameAuthOrigin,
  requireTransferTarget,
} from '../../../server/utils/authTransfer'

const find = vi.fn()
const target = vi.fn()
const source = vi.fn()
const remove = vi.fn()
const origin = 'https://blog.example.test'
const proof = 'synthetic-browser-proof'
const code = 'synthetic-single-use-code'
const data = () => ({
  origin,
  tenantId: 'tenant',
  returnPath: '/en/article',
  proofHash: authTransferHash(proof),
  codeHash: authTransferHash(code),
  userId: 'user',
  sessionId: 'source-session',
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('getRequestHeader', getRequestHeader)
  vi.stubGlobal('getRequestURL', getRequestURL)
  vi.stubGlobal('prisma', {
    clientSite: { findFirst: target },
    session: { findFirst: source },
    verification: { findFirst: find, deleteMany: remove },
  })
  target.mockResolvedValue({ id: 'tenant' })
  source.mockResolvedValue({ id: 'source-session' })
  find.mockResolvedValue({ id: 'request', value: JSON.stringify(data()), expiresAt: new Date(Date.now() + 60_000) })
  remove.mockResolvedValue({ count: 1 })
})
afterEach(() => vi.unstubAllGlobals())

describe('custom domain authentication handoff', () => {
  it('requires the exact same Origin for transfer creation and confirmation', () => {
    vi.stubGlobal('getRequestURL', () => new URL('https://app.topiqu.com'))
    vi.stubGlobal('getRequestHeader', () => 'https://evil.example.test')
    expect(() => requireSameAuthOrigin({} as never)).toThrow()
    vi.stubGlobal('getRequestHeader', () => undefined)
    expect(() => requireSameAuthOrigin({} as never)).toThrow()
    vi.stubGlobal('getRequestHeader', () => 'https://app.topiqu.com')
    expect(() => requireSameAuthOrigin({} as never)).not.toThrow()
  })
  it.each([
    'https://evil.example',
    '//evil.example/path',
    'https://blog.example.test//evil.example',
    'javascript:alert(1)',
    'https://user:pass@blog.example.test/path',
  ])('rejects an unsafe return address: %s', (value) => {
    expect(() => authReturnPath(value, origin)).toThrow()
  })
  it('preserves a same-origin invitation path and its fragment', () => {
    expect(authReturnPath(`${origin}/en/invitation/fixture?x=1#details`, origin)).toBe(
      '/en/invitation/fixture?x=1#details',
    )
  })
  it('checks that the destination still belongs to the same verified, active tenant', async () => {
    await loadAuthTransfer('request')
    expect(target).toHaveBeenCalledWith({
      where: { domain: 'blog.example.test', domainVerified: true, deletedAt: null, id: 'tenant' },
      select: { id: true },
    })
    target.mockResolvedValue(null)
    await expect(loadAuthTransfer('request')).rejects.toMatchObject({ statusCode: 403 })
  })
  it('rejects expired or unknown requests', async () => {
    find.mockResolvedValue(null)
    await expect(loadAuthTransfer('request')).rejects.toMatchObject({ statusCode: 400 })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ expiresAt: { gt: expect.any(Date) } }) }),
    )
  })
  it.each([
    ['wrong-code', proof, origin],
    [code, 'wrong-proof', origin],
    [code, proof, 'https://other.example.test'],
  ])(
    'requires the exact code, initiating-browser proof and target origin',
    async (suppliedCode, suppliedProof, suppliedOrigin) => {
      await expect(
        consumeAuthTransfer('request', suppliedCode!, suppliedProof!, suppliedOrigin!),
      ).rejects.toMatchObject({ statusCode: 403 })
      expect(remove).not.toHaveBeenCalled()
    },
  )
  it('rejects a revoked central session before consuming the ticket', async () => {
    source.mockResolvedValue(null)
    await expect(consumeAuthTransfer('request', code, proof, origin)).rejects.toMatchObject({ statusCode: 403 })
    expect(remove).not.toHaveBeenCalled()
  })
  it('consumes atomically and rejects concurrent redemption or replay', async () => {
    await expect(consumeAuthTransfer('request', code, proof, origin)).resolves.toBe('user')
    expect(remove).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'request',
          value: JSON.stringify(data()),
          expiresAt: { gt: expect.any(Date) },
        }),
      }),
    )
    remove.mockResolvedValue({ count: 0 })
    await expect(consumeAuthTransfer('request', code, proof, origin)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('never accepts a platform host as a custom-domain destination', async () => {
    await expect(requireTransferTarget('https://app.topiqu.com')).rejects.toMatchObject({ statusCode: 403 })
  })
})
