import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('article draft autosave', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const setup = async (body: Record<string, unknown>) => {
    const create = vi.fn().mockResolvedValue({ id: 'draft-1' })
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: 'draft-1' })
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: () => 'Not found' }))
    vi.stubGlobal('requireTenantScope', async () => ({ user: { id: 'user-1', clientSiteId: 'site-1' } }))
    vi.stubGlobal('assertTenantMedia', async () => {})
    vi.stubGlobal('readValidatedBody', async (_event: unknown, parse: (value: unknown) => unknown) => parse(body))
    vi.stubGlobal('prisma', {
      clientSite: { findUnique: vi.fn().mockResolvedValue({ id: 'site-1' }) },
      articleDraft: { create, updateMany, findUniqueOrThrow },
    })
    const handler = (await import('../../../server/api/articles/draft/index.post')).default
    return { run: () => handler({} as never), create, updateMany, findUniqueOrThrow }
  }

  it('creates the first recovery draft and returns its id', async () => {
    const { run, create, updateMany } = await setup({ title: 'First title', content: '<p>First version</p>' })
    expect(await run()).toMatchObject({ draft: { id: 'draft-1' } })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'First title', userId: 'user-1', clientSiteId: 'site-1' }),
      }),
    )
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('updates only the owner’s existing draft instead of making another copy', async () => {
    const { run, create, updateMany } = await setup({
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Revised title',
      content: '<p>Revised version</p>',
    })
    await run()
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: '00000000-0000-4000-8000-000000000001', userId: 'user-1', clientSiteId: 'site-1' },
      data: expect.objectContaining({ title: 'Revised title', content: '<p>Revised version</p>' }),
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('does not create a replacement when the requested draft is missing or belongs to another tenant', async () => {
    const { run, create, updateMany, findUniqueOrThrow } = await setup({
      id: '00000000-0000-4000-8000-000000000001',
      title: 'Revised title',
    })
    updateMany.mockResolvedValue({ count: 0 })
    await expect(run()).rejects.toMatchObject({ statusCode: 404 })
    expect(create).not.toHaveBeenCalled()
    expect(findUniqueOrThrow).not.toHaveBeenCalled()
  })
})
