import { afterEach, describe, expect, it, vi } from 'vitest'

import { uiLanguageOf } from '../../shared/utils/language'

const setup = async (alreadySent = false) => {
  const sendEmail = vi.fn()
  const createNotification = vi.fn()
  const logAction = vi.fn()
  const findSite = vi.fn().mockResolvedValue({
    name: 'Stavební rádce',
    domain: 'radce.example',
    logoUrl: null,
    tenantMemberships: [
      { user: { id: 'owner', email: 'owner@radce.example', language: 'cs' } },
      { user: { id: 'editor', email: 'editor@radce.example', language: 'de' } },
    ],
  })
  vi.stubGlobal('prisma', {
    log: { findUnique: vi.fn().mockResolvedValue(alreadySent ? { id: 'log' } : null) },
    clientSite: { findUnique: findSite },
    notification: { create: createNotification },
  })
  vi.stubGlobal('sendEmail', sendEmail)
  vi.stubGlobal('logAction', logAction)
  vi.stubGlobal('uiLanguageOf', uiLanguageOf)
  vi.stubGlobal(
    'getServerTranslator',
    async (lang: string) =>
      (key: string, [title]: string[]) =>
        `${lang}:${key}:${title}`,
  )
  const { notifyArticleHeld } = await import('../../server/utils/articleHeld')
  const run = () =>
    notifyArticleHeld('site-1', { id: 'article-1', slug: 'pokuty-za-stavbu', title: 'Pokuty za stavbu' })
  return { run, sendEmail, createNotification, logAction, findSite }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('notifyArticleHeld', () => {
  it('tells everyone who can publish, in their language, with a link to the editor banner', async () => {
    const { run, sendEmail, createNotification, logAction, findSite } = await setup()
    await expect(run()).resolves.toEqual({ sent: 2 })

    expect(findSite.mock.calls[0]![0].select.tenantMemberships.where.OR).toEqual([
      { role: 'OWNER' },
      { scopes: { has: 'ARTICLE_PUBLISH' } },
    ])
    expect(createNotification).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'editor',
        articleId: 'article-1',
        link: '/de/admin/editor/pokuty-za-stavbu',
        message: 'de:common.notifications.articleHeld:Pokuty za stavbu',
        type: 'SYSTEM',
      }),
    })
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@radce.example',
        lang: 'cs',
        template: 'articleHeld',
        data: expect.objectContaining({ reviewUrl: 'https://radce.example/cs/admin/editor/pokuty-za-stavbu' }),
      }),
    )
    expect(logAction).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'article-held:article-1' }))
  })

  it('sends once per article', async () => {
    const { run, sendEmail, createNotification } = await setup(true)
    await expect(run()).resolves.toEqual({ sent: 0 })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })
})
