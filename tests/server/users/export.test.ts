import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  USER_EXPORT_ACCOUNT_SELECT,
  USER_EXPORT_BATCH_SIZE,
  userExportChunks,
  userExportStream,
} from '../../../server/utils/userExport'

const USER_ID = 'user-1'
const OWNED_SITE = 'site-owned'
const account = { id: USER_ID, username: 'jan', email: 'jan@example.test' }
const FORBIDDEN_FIELDS = [
  'password',
  'totpSecret',
  'totpTempSecret',
  'onboardingLoginToken',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'hash',
  'storageKey',
  'bannedById',
]

type Call = { model: string; args: { where?: unknown; select?: Record<string, unknown>; skip?: number; take?: number } }

const fakeDb = (rowsFor: (model: string, args: Call['args']) => object[] = () => []) => {
  const calls: Call[] = []
  const db = new Proxy(
    {},
    {
      get: (_, model: string) => ({
        findMany: async (args: Call['args']) => {
          calls.push({ model, args })
          if (model === 'tenantMembership' && args.select?.clientSiteId && !args.select.clientSite)
            return [{ clientSiteId: OWNED_SITE }]
          return rowsFor(model, args)
        },
      }),
    },
  )
  return { db: db as never, calls }
}

const collect = async (chunks: AsyncIterable<string>) => {
  let text = ''
  for await (const chunk of chunks) text += chunk
  return text
}

describe('userExportChunks', () => {
  it('produces one valid JSON document with every section', async () => {
    const { db } = fakeDb()
    const parsed = JSON.parse(await collect(userExportChunks(db, account)))

    expect(parsed.format).toBe('topiqu-account-export')
    expect(parsed.account).toEqual(account)
    for (const section of ['articles', 'articleDrafts', 'comments', 'media', 'knowledgeSources', 'securityEvents'])
      expect(parsed[section]).toEqual([])
  })

  it('reads past one batch without dropping or repeating rows', async () => {
    const total = USER_EXPORT_BATCH_SIZE + 7
    const rows = Array.from({ length: total }, (_, index) => ({ id: `c${index}`, content: `comment ${index}` }))
    const { db } = fakeDb((model, { skip = 0, take = 0 }) => (model === 'comment' ? rows.slice(skip, skip + take) : []))

    const parsed = JSON.parse(await collect(userExportChunks(db, account)))

    expect(parsed.comments.map((row: { id: string }) => row.id)).toEqual(rows.map((row) => row.id))
  })

  it('never selects a secret or internal field', async () => {
    const { db, calls } = fakeDb()
    await collect(userExportChunks(db, account))

    expect(calls.length).toBeGreaterThan(10)
    const selected = [
      ...Object.keys(USER_EXPORT_ACCOUNT_SELECT),
      ...calls.flatMap(({ args }) => Object.keys(args.select ?? {})),
    ]
    for (const field of FORBIDDEN_FIELDS) expect(selected).not.toContain(field)
    for (const { model, args } of calls) expect(args.select, model).toBeDefined()
  })

  it('binds every query to the signed-in user or a blog they own', async () => {
    const { db, calls } = fakeDb()
    await collect(userExportChunks(db, account))

    for (const { model, args } of calls) expect(JSON.stringify(args.where), model).toContain(USER_ID)
    const sharedWithOwnedBlogs = calls.filter(({ args }) => JSON.stringify(args.where).includes(OWNED_SITE))
    expect(sharedWithOwnedBlogs.map(({ model }) => model).sort()).toEqual(['article', 'knowledgeSource', 'mediaAsset'])
  })

  it("marks whether an owned blog's article was written by the user, without exposing the other author", async () => {
    const { db } = fakeDb((model) =>
      model === 'article'
        ? [
            { id: 'mine', userId: USER_ID, title: 'Mine' },
            { id: 'theirs', userId: 'user-2', title: 'Theirs' },
          ]
        : [],
    )

    const { articles } = JSON.parse(await collect(userExportChunks(db, account)))

    expect(articles).toEqual([
      { id: 'mine', title: 'Mine', authoredByYou: true },
      { id: 'theirs', title: 'Theirs', authoredByYou: false },
    ])
  })

  it('keeps only the device and location fields of an audit row', async () => {
    const { db } = fakeDb((model) =>
      model === 'log'
        ? [
            {
              action: 'SESSION_CREATE',
              createdAt: new Date('2026-11-05T00:00:00Z'),
              ip: '192.0.2.1',
              metadata: { device: 'Desktop', city: 'Praha', sessionId: 'secret-session', targetUserId: 'user-2' },
            },
          ]
        : [],
    )

    const { securityEvents } = JSON.parse(await collect(userExportChunks(db, account)))

    expect(securityEvents).toEqual([
      {
        action: 'SESSION_CREATE',
        createdAt: '2026-11-05T00:00:00.000Z',
        ip: '192.0.2.1',
        device: 'Desktop',
        os: null,
        browser: null,
        city: 'Praha',
        country: null,
      },
    ])
  })
})

describe('userExportChunks audit rows', () => {
  it("keeps out the IP on rows that may record someone else's action", async () => {
    const { db } = fakeDb((model) =>
      model === 'log'
        ? [{ action: 'INVITATION_DECLINED', createdAt: new Date(), ip: '198.51.100.7', metadata: null }]
        : [],
    )

    const { securityEvents } = JSON.parse(await collect(userExportChunks(db, account)))

    expect(securityEvents[0].ip).toBeNull()
  })
})

describe('userExportStream', () => {
  it('fails the download instead of ending with a truncated file', async () => {
    const { db } = fakeDb((model) => {
      if (model === 'comment') throw new Error('database unavailable')
      return []
    })

    await expect(new Response(userExportStream(db, account)).text()).rejects.toThrow('database unavailable')
  })
})

describe('GET /api/users/export', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const setup = async (options: { user?: { id: string } | null; allowed?: boolean; found?: boolean } = {}) => {
    const user = options.user === undefined ? { id: USER_ID } : options.user
    const { db } = fakeDb()
    const findUnique = vi.fn(async () => (options.found === false ? null : account))
    const logAction = vi.fn()
    const sendStream = vi.fn((_event: unknown, stream: ReadableStream) => stream)
    const setResponseHeaders = vi.fn()

    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
    vi.stubGlobal('getSessionUser', async () => user)
    vi.stubGlobal('consumeRateLimit', async () => options.allowed !== false)
    vi.stubGlobal('getEnhancedPrisma', async () => Object.assign(Object.create(db as object), { user: { findUnique } }))
    vi.stubGlobal('logAction', logAction)
    vi.stubGlobal('getIp', () => '192.0.2.1')
    vi.stubGlobal('setResponseHeaders', setResponseHeaders)
    vi.stubGlobal('sendStream', sendStream)
    vi.stubGlobal('USER_EXPORT_ACCOUNT_SELECT', USER_EXPORT_ACCOUNT_SELECT)
    vi.stubGlobal('userExportStream', userExportStream)

    const handler = (await import('../../../server/api/users/export.get')).default as (event: never) => Promise<unknown>
    return { handler, findUnique, logAction, sendStream, setResponseHeaders }
  }

  it('rejects an anonymous request', async () => {
    const { handler, findUnique } = await setup({ user: null })

    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 401 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('rate-limits before reading any data', async () => {
    const { handler, findUnique } = await setup({ allowed: false })

    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 429 })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('always exports the session user, audits it and sends an uncached attachment', async () => {
    const { handler, findUnique, logAction, setResponseHeaders } = await setup()

    const stream = (await handler({} as never)) as ReadableStream
    const parsed = JSON.parse(await new Response(stream).text())

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: USER_ID } }))
    expect(parsed.account).toEqual(account)
    expect(logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_DATA_EXPORT', userId: USER_ID }))
    expect(setResponseHeaders).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'Content-Disposition': 'attachment; filename="topiqu-account-export.json"',
        'Cache-Control': 'private, no-store',
      }),
    )
  })
})
