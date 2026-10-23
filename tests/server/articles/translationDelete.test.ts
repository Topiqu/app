import { createError } from 'h3'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const setup = async (
  options: {
    missingVersion?: boolean
    lostRace?: boolean
    published?: boolean
    denied?: boolean
    auditFails?: boolean
  } = {},
) => {
  const remove = vi.fn().mockResolvedValue({ count: options.lostRace ? 0 : 1 })
  const scope = vi.fn(async () => {
    if (options.denied) throw createError({ statusCode: 403 })
  })
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => 'tr1')
  vi.stubGlobal('requireDb', async () => ({
    user: { id: 'u1', clientSiteId: 's1' },
    db: {
      articleTranslation: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'tr1',
          articleId: 'a1',
          language: 'fr',
          status: options.published ? 'PUBLISHED' : 'READY',
        }),
        delete: remove,
        deleteMany: remove,
      },
    },
  }))
  vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) =>
    parse(options.missingVersion ? {} : { expectedUpdatedAt: '2026-10-22T12:00:00Z' }),
  )
  vi.stubGlobal('requireArticleAccess', vi.fn())
  vi.stubGlobal('requireTenantScope', scope)
  vi.stubGlobal('invalidateFeed', vi.fn())
  vi.stubGlobal('logAction', options.auditFails ? vi.fn().mockRejectedValue(new Error('Audit unavailable')) : vi.fn())
  vi.stubGlobal('reportCaughtError', vi.fn())
  vi.stubGlobal('getIp', () => '192.0.2.1')
  const handler = (await import('../../../server/api/translations/[id]/index.delete')).default
  return { run: () => handler({} as never), remove, scope }
}

it('requires an observed version before deleting', async () => {
  const { run, remove } = await setup({ missingVersion: true })
  await expect(run()).rejects.toMatchObject({ statusCode: 428, data: { code: 'ARTICLE_VERSION_REQUIRED' } })
  expect(remove).not.toHaveBeenCalled()
})

it('requires publication scope before removing live content', async () => {
  const { run, remove, scope } = await setup({ published: true, denied: true })
  await expect(run()).rejects.toMatchObject({ statusCode: 403 })
  expect(scope).toHaveBeenCalledWith({}, 'ARTICLE_PUBLISH')
  expect(remove).not.toHaveBeenCalled()
})

it('preserves an intervening edit instead of deleting it', async () => {
  const { run } = await setup({ lostRace: true })
  await expect(run()).rejects.toMatchObject({ statusCode: 409, data: { code: 'ARTICLE_EDIT_CONFLICT' } })
  expect(invalidateFeed).not.toHaveBeenCalled()
})

it('deletes the exact tenant/version and invalidates public feeds', async () => {
  const { run, remove } = await setup()
  await expect(run()).resolves.toEqual({ ok: true })
  expect(remove).toHaveBeenCalledWith({
    where: { id: 'tr1', clientSiteId: 's1', status: 'READY', updatedAt: new Date('2026-10-22T12:00:00Z') },
  })
  expect(invalidateFeed).toHaveBeenCalledWith('s1')
})

it('does not turn a committed deletion into a false failure when audit reporting fails', async () => {
  const { run } = await setup({ auditFails: true })
  await expect(run()).resolves.toEqual({ ok: true })
  expect(reportCaughtError).toHaveBeenCalledOnce()
})
