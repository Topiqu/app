import { createError } from 'h3'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TENANT_SCOPES } from '../../server/utils/tenantMembership'

vi.stubGlobal('TENANT_SCOPES', TENANT_SCOPES)

const {
  actAsApiKeyMember,
  apiKeyTenantScopes,
  createApiKeySecret,
  hashApiKey,
  requireApiKey,
  requiredTenantScopes,
  withIdempotency,
} = await import('../../server/utils/apiKeys')

const site = {
  id: 'site-1',
  name: 'Site',
  domain: 'site.topiqu.com',
  description: null,
  logoUrl: null,
  language: 'cs',
  theme: 'blue',
  plan: 'PRO',
  deletedAt: null,
}
const storedKey = {
  id: 'key-1',
  scopes: ['READ', 'WRITE'],
  createdById: 'user-1',
  revokedAt: null,
  deletedAt: null,
  lastUsedAt: new Date(),
  clientSite: site,
}

const event = (headers: Record<string, string> = {}, method = 'POST') =>
  ({ context: {}, method, path: '/api/v1/articles?x=1', headers }) as never

describe('API key secrets', () => {
  it('creates 256-bit keys and stores only a SHA-256 hash and a short prefix', () => {
    const first = createApiKeySecret()
    const second = createApiKeySecret()
    expect(first.key).toMatch(/^sk_[a-f0-9]{64}$/)
    expect(first.key).not.toBe(second.key)
    expect(first.hash).toBe(hashApiKey(first.key))
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(first.hash).not.toContain(first.key.slice(3))
    expect(first.prefix).toBe(first.key.slice(0, 11))
  })

  it('migrates the legacy plaintext key to the same hash the server computes', () => {
    const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261104120000_api_keys/migration.sql'), 'utf8')
    expect(sql).toContain(`encode(sha256(convert_to(btrim("apiKey"), 'UTF8')), 'hex')`)
    expect(sql).toContain(`ARRAY['READ']::"public"."ApiKeyScope"[]`)
    expect(sql).toContain('ALTER TABLE "public"."ClientSite" DROP COLUMN "apiKey"')
    // Postgres' sha256(convert_to(…, 'UTF8')) is plain SHA-256 over UTF-8 bytes, as here (FIPS 180-2 vector).
    expect(hashApiKey('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('API key scopes', () => {
  it('lets GENERATE request a draft without granting general WRITE or PUBLISH access', () => {
    expect(apiKeyTenantScopes(['READ', 'GENERATE'], ['AI_USE', 'ARTICLE_WRITE', 'ARTICLE_PUBLISH'])).toEqual([
      'AI_USE',
      'ARTICLE_WRITE',
    ])
    expect(requiredTenantScopes(['READ', 'GENERATE'])).toEqual(['AI_USE', 'ARTICLE_WRITE'])
  })
  it('never grants more than the key or the member allows', () => {
    expect(apiKeyTenantScopes(['READ', 'WRITE'], ['ARTICLE_WRITE', 'ARTICLE_PUBLISH', 'AI_USE'])).toEqual([
      'ARTICLE_WRITE',
    ])
    expect(apiKeyTenantScopes(['READ', 'WRITE', 'PUBLISH', 'GENERATE'], ['ARTICLE_WRITE'])).toEqual(['ARTICLE_WRITE'])
    expect(apiKeyTenantScopes(['READ'], TENANT_SCOPES)).toEqual([])
    expect(apiKeyTenantScopes(['WRITE', 'PUBLISH', 'GENERATE'], TENANT_SCOPES)).toEqual([
      'ARTICLE_WRITE',
      'ARTICLE_WRITE_OTHERS',
      'ARTICLE_PUBLISH',
      'AI_USE',
    ])
  })

  it('asks the creator only for what the key can do', () => {
    expect(requiredTenantScopes(['READ'])).toEqual([])
    expect(requiredTenantScopes(['READ', 'WRITE', 'PUBLISH', 'GENERATE'])).toEqual([
      'ARTICLE_WRITE',
      'ARTICLE_PUBLISH',
      'AI_USE',
    ])
  })
})

describe('requireApiKey', () => {
  let findUnique: ReturnType<typeof vi.fn>
  let consumeRateLimit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    findUnique = vi.fn().mockResolvedValue(storedKey)
    consumeRateLimit = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('setResponseHeader', vi.fn())
    vi.stubGlobal('getHeader', (e: { headers: Record<string, string> }, name: string) => e.headers[name])
    vi.stubGlobal('consumeRateLimit', consumeRateLimit)
    vi.stubGlobal('prisma', { apiKey: { findUnique, update: vi.fn().mockResolvedValue({}) } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('looks the key up by hash, never by the plaintext value', async () => {
    const e = event({ 'x-api-key': ' sk_secret ' })
    const { key, site: authenticated } = await requireApiKey(e, 'READ')
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { hash: hashApiKey('sk_secret') } }))
    expect(key).toEqual({
      id: 'key-1',
      clientSiteId: 'site-1',
      scopes: ['READ', 'WRITE'],
      createdById: 'user-1',
      plan: 'PRO',
    })
    expect(authenticated).not.toHaveProperty('plan')
    expect(authenticated).not.toHaveProperty('deletedAt')
    expect((e as { context: { apiKey: unknown } }).context.apiKey).toEqual(key)
  })

  it('rejects a missing key before querying', async () => {
    await expect(requireApiKey(event(), 'READ')).rejects.toMatchObject({ statusCode: 401 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown', null],
    ['revoked', { ...storedKey, revokedAt: new Date() }],
    ['of a deleted site', { ...storedKey, clientSite: { ...site, deletedAt: new Date() } }],
  ])('rejects a key that is %s', async (_label, row) => {
    findUnique.mockResolvedValue(row)
    await expect(requireApiKey(event({ 'x-api-key': 'sk_x' }), 'READ')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('refuses a scope the key lacks', async () => {
    await expect(requireApiKey(event({ 'x-api-key': 'sk_x' }), 'GENERATE')).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('limits each key separately', async () => {
    consumeRateLimit.mockResolvedValue(false)
    await expect(requireApiKey(event({ 'x-api-key': 'sk_x' }), 'READ')).rejects.toMatchObject({ statusCode: 429 })
    expect(consumeRateLimit).toHaveBeenCalledWith('api-key:key-1', 120, 60)
  })
})

describe('actAsApiKeyMember', () => {
  const key = { id: 'key-1', clientSiteId: 'site-1', scopes: ['READ', 'WRITE'], createdById: 'user-1', plan: 'PRO' }
  const user = {
    id: 'user-1',
    username: 'jana',
    email: 'jana@example.com',
    role: 'admin',
    avatarUrl: null,
    language: 'cs',
    theme: 'light',
  }
  const setup = (member: unknown, account: unknown = user) => {
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('TENANT_SCOPES', TENANT_SCOPES)
    vi.stubGlobal('hasTeamSeat', vi.fn().mockResolvedValue(true))
    vi.stubGlobal('prisma', {
      user: { findFirst: vi.fn().mockResolvedValue(account) },
      tenantMembership: { findUnique: vi.fn().mockResolvedValue(member) },
    })
  }
  afterEach(() => vi.unstubAllGlobals())

  it('acts as the creator with their scopes narrowed to the key, never as an owner', async () => {
    setup({ id: 'm-1', role: 'OWNER', scopes: [], deletedAt: null })
    const e = event() as { context: Record<string, any> }
    const actor = await actAsApiKeyMember(e as never, key as never)
    expect(actor).toMatchObject({ id: 'user-1', role: 'admin', clientSiteId: 'site-1', sessionId: 'api-key:key-1' })
    expect(e.context.apiKeyMembership).toEqual({
      id: 'm-1',
      clientSiteId: 'site-1',
      userId: 'user-1',
      role: 'MEMBER',
      scopes: ['ARTICLE_WRITE', 'ARTICLE_WRITE_OTHERS'],
    })
  })

  it('keeps a member without publish rights unable to publish, whatever the key says', async () => {
    setup({ id: 'm-1', role: 'MEMBER', scopes: ['ARTICLE_WRITE'], deletedAt: null })
    const e = event() as { context: Record<string, any> }
    await actAsApiKeyMember(e as never, { ...key, scopes: ['READ', 'WRITE', 'PUBLISH'] } as never)
    expect(e.context.apiKeyMembership.scopes).toEqual(['ARTICLE_WRITE'])
  })

  it('downgrades a superadmin creator so tenant policies still apply', async () => {
    setup(null, { ...user, role: 'superadmin' })
    const e = event() as { context: Record<string, any> }
    const actor = await actAsApiKeyMember(e as never, key as never)
    expect(actor.role).toBe('admin')
    expect(e.context.apiKeyMembership.role).toBe('MEMBER')
  })

  it('refuses a member whose team seat is paused after a downgrade', async () => {
    setup({ id: 'm-1', role: 'MEMBER', scopes: ['ARTICLE_WRITE'], deletedAt: null })
    vi.stubGlobal('hasTeamSeat', vi.fn().mockResolvedValue(false))
    await expect(actAsApiKeyMember(event() as never, key as never)).rejects.toMatchObject({
      statusCode: 403,
      data: { code: 'TEAM_SEAT_LIMIT' },
    })
  })

  it.each([
    ['the plan is Basic', { ...key, plan: 'BASIC' }, { id: 'm', role: 'OWNER', scopes: [], deletedAt: null }],
    ['the key has no creator', { ...key, createdById: null }, { id: 'm', role: 'OWNER', scopes: [], deletedAt: null }],
    ['the creator left the site', key, { id: 'm', role: 'MEMBER', scopes: [], deletedAt: new Date() }],
    ['the creator is not a member', key, null],
  ])('refuses to write when %s', async (_label, apiKey, member) => {
    setup(member)
    await expect(actAsApiKeyMember(event() as never, apiKey as never)).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('withIdempotency', () => {
  const key = { id: 'key-1', clientSiteId: 'site-1', scopes: ['WRITE'], createdById: 'user-1', plan: 'PRO' } as never
  let store: Map<string, any>
  let setResponseHeader: ReturnType<typeof vi.fn>

  beforeEach(() => {
    store = new Map()
    setResponseHeader = vi.fn()
    const unique = Object.assign(new Error('unique'), { code: 'P2002' })
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('getHeader', (e: { headers: Record<string, string> }, name: string) => e.headers[name])
    vi.stubGlobal('setResponseStatus', vi.fn())
    vi.stubGlobal('setResponseHeader', setResponseHeader)
    vi.stubGlobal('getResponseStatus', () => 201)
    vi.stubGlobal('toDatabaseJson', (value: unknown) => JSON.parse(JSON.stringify(value)))
    vi.stubGlobal('isUniqueViolation', (error: { code?: string }) => error.code === 'P2002')
    vi.stubGlobal('reportCaughtError', vi.fn().mockResolvedValue(undefined))
    vi.stubGlobal('prisma', {
      apiIdempotencyKey: {
        create: vi.fn(async ({ data }) => {
          if (store.has(data.key)) throw unique
          store.set(data.key, { id: data.key, ...data, statusCode: null, response: null, createdAt: new Date() })
          return { id: data.key }
        }),
        findUnique: vi.fn(async ({ where }) => store.get(where.apiKeyId_key.key) ?? null),
        update: vi.fn(async ({ where, data }) => Object.assign(store.get(where.id), data)),
        deleteMany: vi.fn(async ({ where }) => ({ count: Number(store.delete(where.id)) })),
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('runs without a header unless the route requires one', async () => {
    const run = vi.fn().mockResolvedValue({ ok: true })
    await expect(withIdempotency(event(), key, {}, run)).resolves.toEqual({ ok: true })
    await expect(withIdempotency(event(), key, {}, run, { required: true })).rejects.toMatchObject({ statusCode: 400 })
    expect(run).toHaveBeenCalledOnce()
  })

  it('replays the stored response for a retry instead of running twice', async () => {
    const run = vi.fn().mockResolvedValue({ data: { id: 'a-1' } })
    const e = event({ 'idempotency-key': 'k-1' })
    await withIdempotency(e, key, { title: 'x' }, run)
    await expect(withIdempotency(e, key, { title: 'x' }, run)).resolves.toEqual({ data: { id: 'a-1' } })
    expect(run).toHaveBeenCalledOnce()
    expect(setResponseHeader).toHaveBeenCalledWith(e, 'Idempotent-Replayed', 'true')
    expect(store.get('k-1')).toMatchObject({ statusCode: 201, response: { data: { id: 'a-1' } } })
  })

  it('refuses the same key for a different request', async () => {
    const e = event({ 'idempotency-key': 'k-1' })
    await withIdempotency(e, key, { title: 'x' }, async () => ({}))
    await expect(withIdempotency(e, key, { title: 'y' }, async () => ({}))).rejects.toMatchObject({ statusCode: 422 })
  })

  it('reports a request that is still running', async () => {
    const e = event({ 'idempotency-key': 'k-1' })
    let release!: () => void
    const first = withIdempotency(e, key, {}, () => new Promise<object>((done) => (release = () => done({}))))
    await vi.waitFor(() => expect(store.has('k-1')).toBe(true))
    await expect(withIdempotency(e, key, {}, async () => ({}))).rejects.toMatchObject({ statusCode: 409 })
    release()
    await first
  })

  it.each([400, 402])(
    'releases a rejected request (%i) so it can retry after correction or top-up',
    async (statusCode) => {
      const e = event({ 'idempotency-key': 'k-1' })
      await expect(
        withIdempotency(e, key, {}, async () => {
          throw createError({ statusCode })
        }),
      ).rejects.toMatchObject({ statusCode })
      expect(store.has('k-1')).toBe(false)
      await expect(withIdempotency(e, key, {}, async () => ({ ok: true }))).resolves.toEqual({ ok: true })
    },
  )

  it('delivers a committed result when replay storage fails and never repeats the operation', async () => {
    const e = event({ 'idempotency-key': 'lost-response' })
    const run = vi.fn().mockResolvedValue({ data: { id: 'generation-1' } })
    vi.mocked(prisma.apiIdempotencyKey.update).mockRejectedValueOnce(new Error('Database unavailable'))
    await expect(withIdempotency(e, key, {}, run)).resolves.toEqual({ data: { id: 'generation-1' } })
    await expect(withIdempotency(e, key, {}, run)).rejects.toMatchObject({ statusCode: 409 })
    expect(run).toHaveBeenCalledOnce()
    expect(reportCaughtError).toHaveBeenCalled()
  })

  it('retains an uncertain operation beyond the completed-response TTL', async () => {
    const e = event({ 'idempotency-key': 'uncertain' })
    const run = vi.fn().mockRejectedValue(new Error('Connection lost after commit'))
    await expect(withIdempotency(e, key, {}, run)).rejects.toThrow('Connection lost after commit')
    store.get('uncertain').createdAt = new Date(Date.now() - 25 * 60 * 60_000)
    await expect(withIdempotency(e, key, {}, run)).rejects.toMatchObject({ statusCode: 409 })
    expect(run).toHaveBeenCalledOnce()
  })
})
