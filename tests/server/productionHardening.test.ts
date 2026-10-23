import sharp from 'sharp'
import { createError } from 'h3'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/imageAnalysis'), 'analyzeImage', 'IMAGE_MODERATION_POLICY_VERSION')
  await stubNitroImports(import('../../server/utils/databaseJson'), 'toDatabaseJson')
  await stubNitroImports(import('../../server/utils/mediaLibrary'), 'storageKeyFromMediaUrl')
  await stubNitroImports(import('../../server/utils/uploadModeration'), 'canReuseUpload', 'recordUploadModeration')
  await stubNitroImports(import('../../server/utils/passwordReset'), 'passwordResetHash', 'passwordResetIdentifier')
  await stubNitroImports(
    import('../../server/utils/stripeWebhook'),
    'extractSubscriptionId',
    'isSubscribablePlan',
    'marksFirstPayment',
    'planFromPriceId',
    'revokesPlan',
  )
}

await stubImports()

const { requireCron } = await import('../../server/utils/requireCron')
const { articleCardSelect } = await import('../../server/utils/articleCard')
const { passwordResetHash } = await import('../../server/utils/passwordReset')

vi.mock('../../server/utils/imageAnalysis', () => ({
  analyzeImage: vi.fn().mockResolvedValue({ tags: [], moderation: 'clear' }),
  IMAGE_MODERATION_POLICY_VERSION: 1,
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

const setup = () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
}

describe('cron boundary', () => {
  it.each([undefined, '', 'configured-secret'])('rejects a missing or incorrect bearer with secret %s', (secret) => {
    setup()
    vi.stubEnv('CRON_SECRET', secret)
    vi.stubGlobal('getHeader', () => 'Bearer undefined')
    expect(() => requireCron({} as never)).toThrow()
  })
  it('accepts the configured secret', () => {
    setup()
    vi.stubEnv('CRON_SECRET', 'configured-secret')
    vi.stubGlobal('getHeader', () => 'Bearer configured-secret')
    expect(() => requireCron({} as never)).not.toThrow()
  })
})

describe('public article projection', () => {
  it('denies private user details to other signed-in accounts before loading any data', async () => {
    setup()
    vi.stubGlobal('getSessionUser', async () => ({ id: 'reader', role: 'reader' }))
    vi.stubGlobal('getRouterParams', () => ({ id: 'another-user' }))
    const database = vi.fn()
    vi.stubGlobal('getEnhancedPrisma', database)
    const { default: route } = await import('../../server/api/users/[id]/index.get')
    await expect(route({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(database).not.toHaveBeenCalled()
  })
  it('does not select private editor, accounting or generation fields', () => {
    const select = articleCardSelect()
    for (const field of ['prompt', 'savedAmount', 'savedTimeMinutes', 'newsUrl', 'structureVariant'])
      expect(select).not.toHaveProperty(field)
    expect(select.user.select).not.toHaveProperty('email')
    expect(select.reactions.where).toEqual({ id: '' })
    expect(articleCardSelect('viewer').reactions.where).toEqual({ userId: 'viewer' })
  })
})

describe('upload ownership and validation', () => {
  async function upload(options: { denied?: boolean; type?: string; svg?: boolean } = {}) {
    setup()
    const bytes = options.svg
      ? Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
      : await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } })
          .png()
          .toBuffer()
    vi.stubGlobal('getSessionUser', async () => ({ id: 'actor', clientSiteId: 'tenant', role: 'admin' }))
    vi.stubGlobal('readMultipartFormData', async () => [
      { name: 'file', filename: 'image.png', type: 'image/png', data: bytes },
      { name: 'customFilename', data: Buffer.from('victim.png') },
      { name: 'type', data: Buffer.from(options.type ?? 'client-logo') },
    ])
    const scope = vi.fn(async () => {
      if (options.denied) throw createError({ statusCode: 403 })
    })
    vi.stubGlobal('requireTenantScope', scope)
    vi.stubGlobal('consumeRateLimit', async () => true)
    vi.stubGlobal('hashMedia', () => 'content-hash')
    const put = vi.fn(async (key: string) => `https://cdn.example.invalid/${key}`)
    vi.stubGlobal('putToCdn', put)
    const { analyzeImage } = await import('../../server/utils/imageAnalysis')
    vi.mocked(analyzeImage).mockClear()
    const { default: route } = await import('../../server/api/upload')
    return { run: () => route({} as never), put, scope, analyzeImage }
  }
  it('ignores a client-selected object key and stores a decoded image in the tenant namespace', async () => {
    const { run, put, scope } = await upload()
    const result = await run()
    expect(scope).toHaveBeenCalledWith(expect.anything(), 'TENANT_SETTINGS')
    expect(put.mock.calls[0]?.[0]).toMatch(/^uploads\/tenant\/[a-f0-9-]{36}\.webp$/)
    expect(result.optimizedUrl).toBe(result.url)
  })
  it('rejects forbidden uploads before moderation or storage', async () => {
    const { run, put, analyzeImage } = await upload({ denied: true })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(put).not.toHaveBeenCalled()
    expect(analyzeImage).not.toHaveBeenCalled()
  })
  it('rejects active SVG data even when its declared MIME is PNG', async () => {
    const { run, put, analyzeImage } = await upload({ svg: true })
    await expect(run()).rejects.toMatchObject({ statusCode: 400 })
    expect(put).not.toHaveBeenCalled()
    expect(analyzeImage).not.toHaveBeenCalled()
  })
})

describe('password reset consumption', () => {
  async function reset(consumed: number) {
    setup()
    vi.stubEnv('AUTH_SECRET', 'synthetic-test-secret')
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (body: unknown) => unknown) =>
      parse({ email: 'reader@example.invalid', code: 'abcdef12', password: 'new-password' }),
    )
    vi.stubGlobal('consumeRateLimit', async () => true)
    vi.stubGlobal('ipKey', () => 'ip-hash')
    vi.stubGlobal('getIp', () => '127.0.0.1')
    vi.stubGlobal('logAction', vi.fn())
    const tx = {
      verification: { deleteMany: vi.fn().mockResolvedValue({ count: consumed }) },
      user: { update: vi.fn() },
      session: { deleteMany: vi.fn() },
    }
    vi.stubGlobal('prisma', {
      user: { findFirst: async () => ({ id: 'user', clientSiteId: 'tenant' }) },
      $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
    })
    const { default: route } = await import('../../server/api/auth/reset.post')
    return { run: () => route({} as never), tx }
  }
  it('consumes only a hashed reset-purpose token and revokes all previous sessions', async () => {
    const { run, tx } = await reset(1)
    await run()
    expect(tx.verification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ identifier: 'password-reset:user', value: passwordResetHash('abcdef12') }),
      }),
    )
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user' } })
  })
  it('never changes a password or session when a code was consumed or invalid', async () => {
    const { run, tx } = await reset(0)
    await expect(run()).rejects.toMatchObject({ statusCode: 400 })
    expect(tx.user.update).not.toHaveBeenCalled()
    expect(tx.session.deleteMany).not.toHaveBeenCalled()
  })
})

describe('Stripe subscription reconciliation', () => {
  it('does not revoke a new subscription when a deletion of the old subscription arrives', async () => {
    setup()
    vi.stubGlobal('readRawBody', async () => 'signed mock event')
    vi.stubGlobal('getHeader', () => 'mock signature')
    vi.stubGlobal('useStripe', () => ({
      webhooks: {
        constructEvent: () => ({
          type: 'customer.subscription.deleted',
          data: { object: { id: 'old', metadata: { clientSiteId: 'tenant' } } },
        }),
      },
    }))
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const sync = vi.fn()
    vi.stubGlobal('serializableTransaction', async (fn: (tx: unknown) => unknown) => fn({ clientSite: { updateMany } }))
    vi.stubGlobal('syncPlanFeatures', sync)
    const { default: route } = await import('../../server/api/stripe/webhook')
    await route({} as never)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ stripeSubscriptionId: 'old' }) }),
    )
    expect(sync).not.toHaveBeenCalled()
  })
})

beforeEach(stubImports)
