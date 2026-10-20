import { createError } from 'h3'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { authenticator } from 'otplib'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

mockNuxtImport('useRuntimeConfig', () => () => ({ auth: { secret: 'test-secret' } }))

const stubUtilGlobals = (allowed = true) => {
  vi.stubGlobal('createError', createError)
  vi.stubGlobal(
    'consumeRateLimit',
    vi.fn(async () => allowed),
  )
}

const loadUtil = () => import('../../../server/utils/totpChallenge')

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

afterEach(() => vi.useRealTimers())

describe('TOTP tokens', () => {
  beforeEach(() => stubUtilGlobals())

  it('round-trips a setup secret for the same user', async () => {
    const { signTotpSetup, verifyTotpSetup } = await loadUtil()
    expect(verifyTotpSetup(signTotpSetup('u1', 'SECRET'), 'u1')).toBe('SECRET')
  })

  it('refuses a setup token minted for another user', async () => {
    const { signTotpSetup, verifyTotpSetup } = await loadUtil()
    expect(() => verifyTotpSetup(signTotpSetup('u1', 'SECRET'), 'u2')).toThrow()
  })

  it('keeps setup tokens and login challenges apart', async () => {
    const { signTotpChallenge, signTotpSetup, verifyTotpChallenge, verifyTotpSetup } = await loadUtil()
    expect(() => verifyTotpChallenge(signTotpSetup('u1', 'SECRET'))).toThrow()
    expect(() => verifyTotpSetup(signTotpChallenge('u1'), 'u1')).toThrow()
    expect(verifyTotpChallenge(signTotpChallenge('u1'))).toEqual({ userId: 'u1' })
  })

  it('rejects a tampered payload', async () => {
    const { signTotpSetup, verifyTotpSetup } = await loadUtil()
    const [, sig] = signTotpSetup('u1', 'SECRET').split('.')
    const forged = Buffer.from(JSON.stringify({ purpose: 'setup', userId: 'u1', secret: 'MINE', exp: 9e15 })).toString(
      'base64url',
    )
    expect(() => verifyTotpSetup(`${forged}.${sig}`, 'u1')).toThrow()
  })

  it('expires a setup token after ten minutes', async () => {
    vi.useFakeTimers()
    const { signTotpSetup, verifyTotpSetup } = await loadUtil()
    const token = signTotpSetup('u1', 'SECRET')
    vi.advanceTimersByTime(10 * 60 * 1000 + 1)
    expect(() => verifyTotpSetup(token, 'u1')).toThrow(/expired/)
  })
})

describe('checkTotpCode', () => {
  const secret = authenticator.generateSecret()

  it('accepts the current code', async () => {
    stubUtilGlobals()
    const { checkTotpCode } = await loadUtil()
    await expect(checkTotpCode('u1', secret, authenticator.generate(secret))).resolves.toBe('ok')
  })

  it('rejects a wrong or missing code and a missing secret', async () => {
    stubUtilGlobals()
    const { checkTotpCode } = await loadUtil()
    await expect(checkTotpCode('u1', secret, '000000')).resolves.toBe('invalid')
    await expect(checkTotpCode('u1', secret, undefined)).resolves.toBe('invalid')
    await expect(checkTotpCode('u1', null, authenticator.generate(secret))).resolves.toBe('invalid')
  })

  it('stops checking once the per-user budget is spent, even for a correct code', async () => {
    stubUtilGlobals(false)
    const { checkTotpCode } = await loadUtil()
    await expect(checkTotpCode('u1', secret, authenticator.generate(secret))).resolves.toBe('limited')
  })
})

describe('PATCH /api/users/:id 2FA and password', () => {
  const secret = authenticator.generateSecret()

  const setup = async (options: {
    body: Record<string, unknown>
    actor?: { id: string; role: string; sessionId?: string }
    targetId?: string
    stored?: { password: string | null; totpSecret: string | null }
    sessionCreatedAt?: Date | null
    claimed?: number
  }) => {
    stubUtilGlobals()
    const util = await loadUtil()
    const actor = {
      email: 'a@example.com',
      clientSiteId: null,
      sessionId: 's1',
      role: 'reader',
      id: 'u1',
      ...options.actor,
    }
    const update = vi.fn(async () => ({}))
    const updateMany = vi.fn(async () => ({ count: options.claimed ?? 1 }))
    const saveUserWithLogging = vi.fn(async () => ({ id: options.targetId ?? actor.id }))
    const sessionFindFirst = vi.fn(async () =>
      options.sessionCreatedAt === null ? null : { createdAt: options.sessionCreatedAt ?? new Date() },
    )

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getSessionUser', async () => actor)
    vi.stubGlobal('getRouterParams', () => ({ id: options.targetId ?? actor.id }))
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) =>
      parse(options.body),
    )
    vi.stubGlobal('getEnhancedPrisma', async () => ({
      user: { update, updateMany, findUnique: vi.fn(async () => ({ role: actor.role })) },
    }))
    vi.stubGlobal('prisma', {
      user: { findUnique: vi.fn(async () => options.stored ?? { password: null, totpSecret: null }) },
      session: { findFirst: sessionFindFirst },
    })
    vi.stubGlobal('saveUserWithLogging', saveUserWithLogging)
    vi.stubGlobal('logAction', vi.fn())
    vi.stubGlobal('getIp', () => '127.0.0.1')
    vi.stubGlobal('checkTotpCode', util.checkTotpCode)
    vi.stubGlobal('signTotpSetup', util.signTotpSetup)
    vi.stubGlobal('verifyTotpSetup', util.verifyTotpSetup)

    const handler = (await import('../../../server/api/users/[id]/index.patch')).default as (
      event: never,
    ) => Promise<Record<string, unknown>>
    return { run: () => handler({} as never), update, updateMany, saveUserWithLogging, util }
  }

  it('starts setup without storing the secret', async () => {
    const { run, update, updateMany } = await setup({ body: { totpAction: 'enable' } })
    const response = await run()
    expect(response).toHaveProperty('otpauthUrl')
    expect(response).toHaveProperty('totpSetup')
    expect(update).not.toHaveBeenCalled()
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('never hands out an existing secret', async () => {
    const { run } = await setup({ body: { totpAction: 'enable' }, stored: { password: 'x', totpSecret: secret } })
    await expect(run()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('stores the secret only after its first code checks out, guarded on no prior secret', async () => {
    stubUtilGlobals()
    const { signTotpSetup } = await loadUtil()
    const { run, updateMany } = await setup({
      body: { totpSetup: signTotpSetup('u1', secret), totpCode: authenticator.generate(secret) },
    })
    await expect(run()).resolves.toEqual({ verified: true })
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'u1', totpSecret: null }, data: { totpSecret: secret } })
  })

  it('does not replace an authenticator confirmed in the meantime', async () => {
    stubUtilGlobals()
    const { signTotpSetup } = await loadUtil()
    const { run } = await setup({
      body: { totpSetup: signTotpSetup('u1', secret), totpCode: authenticator.generate(secret) },
      claimed: 0,
    })
    await expect(run()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects a wrong setup code without writing', async () => {
    stubUtilGlobals()
    const { signTotpSetup } = await loadUtil()
    const { run, updateMany } = await setup({ body: { totpSetup: signTotpSetup('u1', secret), totpCode: '000000' } })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('requires the current code to switch 2FA off', async () => {
    const stored = { password: 'x', totpSecret: secret }
    const denied = await setup({ body: { totpAction: 'disable' }, stored })
    await expect(denied.run()).rejects.toMatchObject({ statusCode: 403 })
    expect(denied.update).not.toHaveBeenCalled()

    const allowed = await setup({ body: { totpAction: 'disable', totpCode: authenticator.generate(secret) }, stored })
    await expect(allowed.run()).resolves.toEqual({ verified: false })
    expect(allowed.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { totpSecret: null } })
  })

  it('lets a superadmin clear another user’s 2FA for recovery', async () => {
    const { run, update } = await setup({
      body: { totpAction: 'disable' },
      actor: { id: 'admin', role: 'superadmin' },
      targetId: 'u1',
      stored: { password: 'x', totpSecret: secret },
    })
    await expect(run()).resolves.toEqual({ verified: false })
    expect(update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { totpSecret: null } })
  })

  it('ignores the old `totpSecret: null` shortcut', async () => {
    const { run, update, saveUserWithLogging } = await setup({
      body: { totpSecret: null },
      stored: { password: 'x', totpSecret: secret },
    })
    await run()
    expect(update).not.toHaveBeenCalled()
    expect(saveUserWithLogging).toHaveBeenCalledWith(expect.anything(), { id: 'u1' }, true)
  })

  it('lets a password-less account set a password only right after signing in', async () => {
    const stale = await setup({
      body: { password: 'new-password' },
      sessionCreatedAt: new Date(Date.now() - 11 * 60_000),
    })
    await expect(stale.run()).rejects.toMatchObject({ statusCode: 403, message: 'common.errors.reauthRequired' })
    expect(stale.saveUserWithLogging).not.toHaveBeenCalled()

    const fresh = await setup({ body: { password: 'new-password' } })
    await fresh.run()
    expect(fresh.saveUserWithLogging).toHaveBeenCalled()
  })

  it('treats a missing session row as stale', async () => {
    const { run } = await setup({ body: { password: 'new-password' }, sessionCreatedAt: null })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('GET /api/users/:id/account', () => {
  it('reports whether 2FA is on without exposing the secret', () => {
    const source = readFileSync(resolve(process.cwd(), 'server/api/users/[id]/account.get.ts'), 'utf8')
    expect(source).toContain('totpEnabled: !!userData.totpSecret,')
    expect(source).not.toMatch(/totpSecret: userData|otpauthUrl/)
  })
})
