// @vitest-environment node
import { createError } from 'h3'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  queueContentAction: vi.fn(),
  applyContentAction: vi.fn(),
  rollbackContentAction: vi.fn(),
  dismissContentAction: vi.fn(),
}))
vi.mock('../../../server/utils/keywords/refresh', () => actions)

let command: string
let user: { id: string; role: string; clientSiteId: string }
let scopes: string[]
let db: { contentAction: { findFirst: ReturnType<typeof vi.fn> }; clientSite: { findUnique: ReturnType<typeof vi.fn> } }
let handle: (event: unknown) => Promise<unknown>

beforeEach(async () => {
  vi.resetAllMocks()
  command = 'prepare'
  scopes = ['ARTICLE_WRITE', 'ARTICLE_WRITE_OTHERS', 'AI_USE', 'ARTICLE_PUBLISH']
  user = { id: 'editor1', role: 'admin', clientSiteId: 'site1' }
  db = {
    contentAction: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'action1',
        clientSiteId: 'site1',
        status: 'SUGGESTED',
        proposal: null,
        snapshot: null,
        article: { userId: 'editor1' },
      }),
    },
    clientSite: { findUnique: vi.fn().mockResolvedValue({ plan: 'PREMIUM' }) },
  }
  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal(
    'requireDb',
    vi.fn().mockImplementation(async () => ({ user, db })),
  )
  vi.stubGlobal('getRouterParam', () => 'action1')
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (input: unknown) => unknown) =>
    parse({ action: command }),
  )
  vi.stubGlobal(
    'requireTenantScope',
    vi.fn().mockImplementation(async (_event: unknown, scope: string) => {
      if (!scopes.includes(scope)) throw createError({ statusCode: 403, message: `Missing tenant scope: ${scope}` })
      return { membership: { scopes } }
    }),
  )
  vi.stubGlobal('hasTenantScope', (membership: { scopes: string[] }, scope: string) =>
    membership.scopes.includes(scope),
  )
  vi.stubGlobal('hasActiveFeature', vi.fn().mockResolvedValue(true))
  vi.stubGlobal('runTask', vi.fn().mockResolvedValue({}))
  handle = (await import('../../../server/api/content-actions/[id].post')).default as typeof handle
})
afterEach(() => vi.unstubAllGlobals())

describe('content action authorization', () => {
  it('uses the session tenant and passes its enhanced database to preparation', async () => {
    expect(await handle({})).toEqual({ success: true })
    expect(requireDb).toHaveBeenCalledWith({}, { role: ['admin', 'superadmin'], clientSite: true })
    expect(db.contentAction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'action1', clientSiteId: 'site1' } }),
    )
    expect(actions.queueContentAction).toHaveBeenCalledWith(db, expect.objectContaining({ id: 'action1' }), 'PREMIUM')
    expect(runTask).toHaveBeenCalledWith('content-actions')
  })
  it('returns 404 for a foreign action without calling a mutation', async () => {
    db.contentAction.findFirst.mockResolvedValue(null)
    await expect(handle({})).rejects.toMatchObject({ statusCode: 404 })
    expect(actions.queueContentAction).not.toHaveBeenCalled()
  })
  it.each(['ARTICLE_WRITE', 'AI_USE'])('requires %s before spending a credit', async (scope) => {
    scopes = scopes.filter((value) => value !== scope)
    await expect(handle({})).rejects.toMatchObject({ statusCode: 403 })
    expect(actions.queueContentAction).not.toHaveBeenCalled()
  })
  it('requires permission to edit an article written by another member', async () => {
    scopes = scopes.filter((value) => value !== 'ARTICLE_WRITE_OTHERS')
    db.contentAction.findFirst.mockResolvedValue({ id: 'action1', clientSiteId: 'site1', article: { userId: 'other' } })
    await expect(handle({})).rejects.toMatchObject({ statusCode: 403 })
    expect(actions.queueContentAction).not.toHaveBeenCalled()
  })
  it.each(['apply', 'rollback'])('requires publication permission for %s', async (next) => {
    command = next
    scopes = scopes.filter((value) => value !== 'ARTICLE_PUBLISH')
    await expect(handle({})).rejects.toMatchObject({ statusCode: 403 })
    expect(actions.applyContentAction).not.toHaveBeenCalled()
    expect(actions.rollbackContentAction).not.toHaveBeenCalled()
  })
  it('does not prepare when the tenant disabled AI', async () => {
    vi.mocked(hasActiveFeature).mockResolvedValue(false)
    await expect(handle({})).rejects.toMatchObject({ statusCode: 403 })
    expect(actions.queueContentAction).not.toHaveBeenCalled()
  })
  it.each(['apply', 'rollback', 'dismiss'])('dispatches %s through the enhanced database', async (next) => {
    command = next
    await handle({})
    const fn =
      next === 'apply'
        ? actions.applyContentAction
        : next === 'rollback'
          ? actions.rollbackContentAction
          : actions.dismissContentAction
    expect(fn).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: 'action1' }),
      ...(next === 'dismiss' ? [] : ['editor1']),
    )
  })
})
