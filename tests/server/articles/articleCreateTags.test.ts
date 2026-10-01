import { createError } from 'h3'
import { DbNull } from '@zenstackhq/orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('article creation tags', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const setup = async (aiInvolvement: 'FULL' | 'NONE') => {
    const create = vi.fn().mockRejectedValue(new Error('stop after tag validation'))
    const update = vi.fn()
    const findMany = vi.fn().mockResolvedValue([])
    const body = {
      title: 'Article',
      slug: 'article',
      content: '<p>Content</p>',
      status: 'draft',
      imageUrl: '',
      imageCredit: null as { kind: string } | null,
      coverMediaId: null,
      tags: ['not-a-tenant-tag'],
      aiInvolvement,
    }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('createError', createError)
    vi.stubGlobal('useServerI18n', async () => ({ translate: () => 'Invalid request' }))
    vi.stubGlobal('requireTenantScope', async () => ({ user: { id: 'user-1', clientSiteId: 'site-1' } }))
    const db = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      tag: { findMany },
      article: { create, update },
    }
    vi.stubGlobal('getEnhancedPrisma', async () => ({
      ...db,
      $transaction: (run: (tx: typeof db) => unknown) => run(db),
    }))
    vi.stubGlobal('readBody', async () => body)
    vi.stubGlobal('isCoverImageUrl', () => true)
    vi.stubGlobal('assertTenantMedia', async () => {})
    vi.stubGlobal('applyMediaAttributions', async (_site: string, content: string) => content)
    vi.stubGlobal('stampHeadingIds', (content: string) => content)
    vi.stubGlobal('sanitizeHtml', (content: string) => content)
    vi.stubGlobal('isUniqueViolation', () => false)
    vi.stubGlobal('coverCreditFromMedia', async () => null)
    vi.stubGlobal('syncArticlePolls', async (_db: unknown, _id: string, content: string) => content)
    vi.stubGlobal('syncArticleMediaUsages', async () => {})
    vi.stubGlobal('logAction', async () => {})
    vi.stubGlobal('getIp', () => '127.0.0.1')
    vi.stubGlobal('prisma', { clientSite: { findUnique: vi.fn().mockResolvedValue({ language: 'en' }) } })
    const handler = (await import('../../../server/api/articles/index.post')).default
    return { run: () => handler({} as never), create, update, findMany, body }
  }

  it('drops untrusted AI tag suggestions that do not belong to the tenant', async () => {
    const { run, create, findMany } = await setup('FULL')
    await expect(run()).rejects.toThrow('stop after tag validation')
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['not-a-tenant-tag'] }, clientSiteId: 'site-1' },
      select: { id: true },
    })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tags: undefined }) }))
  })

  it('persists a Czech source language on an English-first site', async () => {
    const { run, create, body } = await setup('FULL')
    Object.assign(body, { language: 'cs' })

    await expect(run()).rejects.toThrow('stop after tag validation')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ language: 'cs' }) }))
  })

  it('rejects a manually supplied foreign or missing tag before article creation', async () => {
    const { run, create } = await setup('NONE')
    await expect(run()).rejects.toMatchObject({ statusCode: 400 })
    expect(create).not.toHaveBeenCalled()
  })

  it('reports an existing article slug as a conflict instead of a generic server error', async () => {
    const { run } = await setup('FULL')
    vi.stubGlobal('isUniqueViolation', () => true)
    await expect(run()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('writes cover credit with a kind field after creation in the same transaction', async () => {
    const { run, create, update, body } = await setup('FULL')
    const credit = { kind: 'ai' }
    body.imageCredit = credit
    const created = {
      id: 'article-1',
      title: body.title,
      content: body.content,
      status: body.status,
      imageUrl: body.imageUrl,
      coverMediaId: body.coverMediaId,
    }
    create.mockResolvedValueOnce(created)
    update.mockResolvedValueOnce({ ...created, imageCredit: credit })

    await expect(run()).resolves.toMatchObject({ imageCredit: credit })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ imageCredit: DbNull }) }),
    )
    expect(update).toHaveBeenCalledWith({ where: { id: created.id }, data: { imageCredit: credit } })
  })
})
