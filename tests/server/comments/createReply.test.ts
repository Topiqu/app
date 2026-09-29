import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('POST /api/comments reply', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const setup = async (parentContent: string) => {
    const body = {
      articleId: 'article-1',
      parentId: 'parent-1',
      content: 'ffuuuuuuuj',
      gifUrl: null,
    }
    const create = vi.fn().mockResolvedValue({ id: 'reply-1', content: body.content, parentId: body.parentId })
    const findFirst = vi.fn().mockResolvedValue({
      content: parentContent,
      user: {
        id: 'parent-user',
        username: 'usbejr',
        email: 'parent@example.com',
        language: 'cs',
        allowEmail: true,
      },
    })
    const sendEmail = vi.fn().mockRejectedValue(new URIError('String contained an illegal UTF-16 sequence'))
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('useServerI18n', async () => ({ translate: () => 'message' }))
    vi.stubGlobal('requireUser', async () => ({ id: 'reply-user', name: 'Author', avatarUrl: null }))
    vi.stubGlobal('readValidatedBody', async () => body)
    vi.stubGlobal('sanitizeHtml', (content: string) => content)
    vi.stubGlobal('commentAudience', async () => [])
    vi.stubGlobal('unsubscribeUrl', () => 'https://example.com/unsubscribe')
    vi.stubGlobal('sendEmail', sendEmail)
    vi.stubGlobal('prisma', {
      article: {
        findUnique: vi.fn().mockResolvedValue({
          id: body.articleId,
          clientSiteId: 'site-1',
          allowedComments: true,
          userId: 'article-author',
          slug: 'article',
          language: 'cs',
          title: 'Article',
          clientSite: { domain: 'example.com' },
        }),
      },
      userBan: { findFirst: vi.fn().mockResolvedValue(null) },
      comment: { findFirst, create },
    })
    const handler = (await import('../../../server/api/comments/index.post')).default
    return { run: () => handler({} as never), create, findFirst, sendEmail }
  }

  it('saves a reply when its notification fails and keeps emoji whole in the email excerpt', async () => {
    const parentContent = `${'a'.repeat(49)}👇🏿 more text`
    const { run, create, findFirst, sendEmail } = await setup(parentContent)
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      await expect(run()).resolves.toMatchObject({ id: 'reply-1' })
      expect(create).toHaveBeenCalledOnce()
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'parent-1', articleId: 'article-1' } }),
      )
      expect(sendEmail).toHaveBeenCalledOnce()
      expect(create.mock.invocationCallOrder[0]).toBeLessThan(sendEmail.mock.invocationCallOrder[0]!)

      const email = sendEmail.mock.calls[0]![0]
      expect(email.data.parentContent).toBe(`${'a'.repeat(49)}👇🏿...`)
      expect(email.data.commentUrl).toContain('#comment-reply-1')
      expect(() => encodeURIComponent(email.data.parentContent)).not.toThrow()
      expect(logged).toHaveBeenCalledOnce()
    } finally {
      logged.mockRestore()
    }
  })
})
