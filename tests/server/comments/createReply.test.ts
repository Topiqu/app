import { createError } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('POST /api/comments reply', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  const setup = async (
    parentContent: string,
    options: {
      commentsEnabled?: boolean
      commentGifsEnabled?: boolean
      allowedComments?: boolean
      gifUrl?: string
    } = {},
  ) => {
    const body = {
      articleId: 'article-1',
      parentId: 'parent-1',
      content: 'ffuuuuuuuj',
      gifUrl: options.gifUrl ?? null,
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
    vi.stubGlobal('createError', createError)
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
          allowedComments: options.allowedComments ?? true,
          userId: 'article-author',
          slug: 'article',
          language: 'cs',
          title: 'Article',
          clientSite: {
            domain: 'example.com',
            commentsEnabled: options.commentsEnabled ?? true,
            commentGifsEnabled: options.commentGifsEnabled ?? true,
          },
        }),
      },
      userBan: { findFirst: vi.fn().mockResolvedValue(null) },
      comment: { findFirst, create },
    })
    const handler = (await import('../../../server/api/comments/index.post')).default
    return { run: () => handler({} as never), create, findFirst, sendEmail }
  }

  it('blocks replies for the whole tenant even when the article allows comments', async () => {
    const { run, create, sendEmail } = await setup('Parent', { commentsEnabled: false })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(create).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('keeps per-article restrictions when tenant comments are enabled', async () => {
    const { run, create } = await setup('Parent', { allowedComments: false })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects a GIF submitted directly to the API when tenant GIFs are disabled', async () => {
    const { run, create } = await setup('Parent', {
      commentGifsEnabled: false,
      gifUrl: 'https://media.giphy.com/media/abc/giphy.gif',
    })
    await expect(run()).rejects.toMatchObject({ statusCode: 403 })
    expect(create).not.toHaveBeenCalled()
  })

  it('still saves text-only replies when GIFs are disabled', async () => {
    const { run, create, sendEmail } = await setup('Parent', { commentGifsEnabled: false })
    sendEmail.mockResolvedValueOnce(undefined as never)
    await expect(run()).resolves.toMatchObject({ id: 'reply-1' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ gifUrl: null }) }))
  })

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
