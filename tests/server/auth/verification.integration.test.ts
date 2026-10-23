// @vitest-environment node
import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { PolicyPlugin } from '@zenstackhq/plugin-policy'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserCreateArgs } from '../../../generated/zenstack/input'

import { appMutationPlugin } from '../../../server/utils/prisma'
import { createDatabaseClient } from '../../../server/utils/database'
import { shouldIssueVerificationCode, VERIFICATION_CODE_TTL_MS } from '../../../server/utils/emailVerification'

const url = process.env.TEST_DATABASE_URL
const enabled = !!url && /test/i.test(new URL(url).pathname) && url !== process.env.DATABASE_URL
const db = enabled ? createDatabaseClient(url).$use(appMutationPlugin) : null
const users: string[] = []
const fixture = async () => {
  const id = randomUUID()
  users.push(id)
  return db!.user.create({ data: { id, username: `u-${id}`, email: `${id}@example.invalid` } })
}
const legacy = (userId: string, code = 'aabbccdd', age = 120_000) =>
  db!.verificationCode.create({
    data: {
      userId,
      code,
      createdAt: new Date(Date.now() - age),
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS - age),
    },
  })
const event = (email: string, user?: { id: string; email: string; name?: string }, code?: string) => ({
  body: { email, code },
  sessionUser: user,
})

describe.skipIf(!enabled)('account-bound email verification on PostgreSQL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('AUTH_SECRET', 'isolated-verification-test-pepper-with-no-real-credentials')
    vi.stubGlobal('prisma', db)
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('readBody', async (request: ReturnType<typeof event>) => request.body)
    vi.stubGlobal('readValidatedBody', async (request: ReturnType<typeof event>, parse: (body: unknown) => unknown) =>
      parse(request.body),
    )
    vi.stubGlobal('getSessionUser', async (request: ReturnType<typeof event>) => request.sessionUser ?? null)
    vi.stubGlobal('ipKey', () => 'test-client-fingerprint')
    vi.stubGlobal('consumeRateLimit', vi.fn().mockResolvedValue(true))
    vi.stubGlobal('sendEmail', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('shouldIssueVerificationCode', shouldIssueVerificationCode)
    vi.stubGlobal('VERIFICATION_CODE_TTL_MS', VERIFICATION_CODE_TTL_MS)
  })
  afterEach(async () => {
    await db?.user.deleteMany({ where: { id: { in: users } } })
    users.length = 0
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  afterAll(async () => db?.$disconnect())

  it('shares the cooldown with the authenticated send entry point', async () => {
    const user = await fixture()
    const before = await legacy(user.id, 'aabbccdd', 0)
    const handler = (await import('../../../server/api/users/send-verification.post')).default
    await handler(event(user.email, user) as never)
    expect(sendEmail).not.toHaveBeenCalled()
    const preserved = await db!.verificationCode.findUniqueOrThrow({
      where: { userId: user.id },
      select: { id: true, code: true },
    })
    expect(preserved.id).toBe(before.id)
    expect(preserved.code === 'aabbccdd').toBe(true)
  })

  it('creates a real policy-checked account before issuing its private hashed code', async () => {
    const scoped = db!.$use(new PolicyPlugin()).$setAuth(undefined)
    vi.stubGlobal(
      'saveUserWithLogging',
      vi.fn(async (_event: unknown, data: UserCreateArgs['data']) => {
        const user = await scoped.user.create({ data, select: { id: true, email: true, username: true } })
        users.push(user.id)
        return user
      }),
    )
    const email = `${randomUUID()}@example.invalid`
    const request = {
      ...event(email),
      body: { email: email.toUpperCase(), username: `u-${randomUUID()}`, password: 'isolated-registration-password' },
    }
    const register = (await import('../../../server/api/auth/register.post')).default
    const user = await register(request as never)
    expect(user.email).toBe(email)
    expect(sendEmail).toHaveBeenCalledOnce()
    const stored = await db!.verificationCode.findUniqueOrThrow({ where: { userId: user.id }, select: { code: true } })
    expect(/^h1:[a-f0-9]{64}$/.test(stored.code)).toBe(true)
    const account = await db!.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { password: true, emailVerified: true },
    })
    expect(account.emailVerified).toBe(false)
    expect(account.password?.startsWith('$argon2')).toBe(true)
  })

  it('checks registration budgets before creating an account', async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue(false)
    const create = vi.fn()
    vi.stubGlobal('saveUserWithLogging', create)
    const register = (await import('../../../server/api/auth/register.post')).default
    const request = {
      ...event(`${randomUUID()}@example.invalid`),
      body: {
        email: `${randomUUID()}@example.invalid`,
        username: `u-${randomUUID()}`,
        password: 'isolated-registration-password',
      },
    }
    await expect(register(request as never)).rejects.toMatchObject({ statusCode: 429 })
    expect(create).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('uses the authoritative account email when an authenticated session carries an old address', async () => {
    const user = await fixture()
    const send = (await import('../../../server/api/users/send-verification.post')).default
    await send(event(user.email, { id: user.id, email: 'outdated@example.invalid' }) as never)
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: user.email }))
  })

  it('returns the public success shape for verified and deleted accounts without mailing them', async () => {
    const verified = await fixture()
    const deleted = await fixture()
    await db!.user.update({ where: { id: verified.id }, data: { emailVerified: true } })
    await db!.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } })
    const send = (await import('../../../server/api/auth/resend-verification.post')).default
    expect(await send(event(verified.email) as never)).toEqual(await send(event(deleted.email) as never))
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('serializes concurrent public and authenticated resends into one issuance and one email', async () => {
    const user = await fixture()
    await legacy(user.id)
    const publicSend = (await import('../../../server/api/auth/resend-verification.post')).default
    const sessionSend = (await import('../../../server/api/users/send-verification.post')).default
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        index % 2 ? sessionSend(event(user.email, user) as never) : publicSend(event(user.email) as never),
      ),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(8)
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(await db!.verificationCode.count({ where: { userId: user.id } })).toBe(1)
    const stored = await db!.verificationCode.findUniqueOrThrow({ where: { userId: user.id }, select: { code: true } })
    expect(/^h1:[a-f0-9]{64}$/.test(stored.code)).toBe(true)
  })

  it('consumes a legacy code only for the requested account when two accounts share its value', async () => {
    const first = await fixture()
    const second = await fixture()
    await legacy(first.id)
    await legacy(second.id)
    const verify = (await import('../../../server/api/auth/verify.post')).default
    await verify(event(second.email.toUpperCase(), undefined, 'aabbccdd') as never)
    expect((await db!.user.findUniqueOrThrow({ where: { id: second.id } })).emailVerified).toBe(true)
    expect((await db!.user.findUniqueOrThrow({ where: { id: first.id } })).emailVerified).toBe(false)
  })

  it('returns one success and one safe rejection when the same code is consumed concurrently', async () => {
    const user = await fixture()
    await legacy(user.id)
    const verify = (await import('../../../server/api/auth/verify.post')).default
    const outcomes = await Promise.allSettled([
      verify(event(user.email, undefined, 'aabbccdd') as never),
      verify(event(user.email, undefined, 'aabbccdd') as never),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason?.statusCode).toBe(400)
    expect(await db!.verificationCode.count({ where: { userId: user.id } })).toBe(0)
  })

  it('rejects expiry and does not revive an over-age legacy code even if its stored expiry is extended', async () => {
    const user = await fixture()
    await legacy(user.id, 'aabbccdd', VERIFICATION_CODE_TTL_MS + 1)
    const verify = (await import('../../../server/api/auth/verify.post')).default
    await expect(verify(event(user.email, undefined, 'aabbccdd') as never)).rejects.toMatchObject({ statusCode: 400 })
    await db!.verificationCode.update({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() + 60_000) },
    })
    await expect(verify(event(user.email, undefined, 'aabbccdd') as never)).rejects.toMatchObject({ statusCode: 400 })
    expect((await db!.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(false)
  })

  it('keeps the public anti-enumeration response on mail failure and permits a bounded retry', async () => {
    const user = await fixture()
    const send = (await import('../../../server/api/auth/resend-verification.post')).default
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Synthetic mail transport unavailable'))
    const failure = await send(event(user.email) as never)
    expect(failure).toMatchObject({ success: true })
    expect(reportCaughtError).toHaveBeenCalledOnce()
    await send(event(user.email) as never)
    expect(sendEmail).toHaveBeenCalledOnce()
    await db!
      .$executeRaw`UPDATE "VerificationCode" SET "createdAt" = now() - interval '61 seconds' WHERE "userId" = ${user.id}`
    const retry = await send(event(user.email) as never)
    const unknown = await send(event(`${randomUUID()}@example.invalid`) as never)
    expect(retry).toEqual(failure)
    expect(unknown).toEqual(failure)
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })

  it('invalidates a newly issued code when its account email changes', async () => {
    const user = await fixture()
    const send = (await import('../../../server/api/auth/resend-verification.post')).default
    await send(event(user.email) as never)
    const code = vi.mocked(sendEmail).mock.calls[0]![0].data.verificationCode
    const email = `${randomUUID()}@example.invalid`
    await db!.user.update({ where: { id: user.id }, data: { email } })
    const verify = (await import('../../../server/api/auth/verify.post')).default
    await expect(verify(event(email, undefined, code) as never)).rejects.toMatchObject({ statusCode: 400 })
    expect((await db!.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(false)
  })

  it('enforces account and IP budgets before issuing or verifying a code', async () => {
    const user = await fixture()
    await legacy(user.id)
    vi.mocked(consumeRateLimit).mockResolvedValue(false)
    const send = (await import('../../../server/api/auth/resend-verification.post')).default
    expect(await send(event(user.email) as never)).toMatchObject({ success: true })
    expect(sendEmail).not.toHaveBeenCalled()
    const verify = (await import('../../../server/api/auth/verify.post')).default
    await expect(verify(event(user.email, undefined, 'aabbccdd') as never)).rejects.toMatchObject({ statusCode: 429 })
    expect((await db!.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(false)
  })

  it('keeps verification secrets inaccessible through enhanced model reads', async () => {
    const user = await fixture()
    await legacy(user.id)
    const scoped = db!.$use(new PolicyPlugin()).$setAuth({ id: user.id, role: 'reader' })
    expect(await scoped.verificationCode.count({ where: { userId: user.id } })).toBe(0)
  })
})
