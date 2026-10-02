import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyArticlePublished } from '../../server/utils/articleNotifications'

const article = { id: 'article-1', title: 'Published article', userId: 'author-1' }
const follower = (id: string, language: string | null = 'en') => ({ followerId: id, follower: { language } })
const database = () => ({
  user: { findUnique: vi.fn().mockResolvedValue({ username: 'Actual author', language: 'cs' }) },
  follow: { findMany: vi.fn().mockResolvedValue([]) },
  notification: { create: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
})
const notificationDb = (db: ReturnType<typeof database>) =>
  db as unknown as Parameters<typeof notifyArticlePublished>[0]
const getTranslator = vi.fn(
  async (language: string) => (key: string, params: string[]) => `${language}:${key}:${params.join('|')}`,
)

describe('article publication notifications', () => {
  beforeEach(() => {
    getTranslator.mockClear()
    vi.stubGlobal('getServerTranslator', getTranslator)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('uses the actual author and each recipient language, sharing translators and the English fallback', async () => {
    const db = database()
    db.follow.findMany.mockResolvedValue([
      follower('reader-1', 'cs'),
      follower('reader-2', null),
      follower('reader-3', 'cs'),
    ])

    await notifyArticlePublished(notificationDb(db), article, { notifyAuthor: true })

    expect(db.follow.findMany).toHaveBeenCalledWith({
      where: { followedId: 'author-1', follower: { allowNotifs: true } },
      select: { followerId: true, follower: { select: { language: true } } },
    })
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'author-1' },
      select: { username: true, language: true },
    })
    expect(getTranslator.mock.calls).toEqual([['cs'], ['en']])
    expect(db.notification.create).toHaveBeenCalledWith({
      data: {
        message: 'cs:common.notifications.articlePublished:Published article',
        userId: 'author-1',
        articleId: 'article-1',
        type: 'ARTICLE_PUBLISHED',
      },
    })
    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: ['reader-1', 'reader-2', 'reader-3'].map((userId, index) => ({
        message: `${index === 1 ? 'en' : 'cs'}:common.notifications.newArticleFromFollowed:Actual author|Published article`,
        userId,
        articleId: 'article-1',
        type: 'ARTICLE_PUBLISHED',
      })),
      skipDuplicates: true,
    })
  })

  it('sends followers only unless an author notification is requested', async () => {
    const db = database()
    db.follow.findMany.mockResolvedValue([follower('reader-1')])

    await notifyArticlePublished(notificationDb(db), article)

    expect(db.notification.create).not.toHaveBeenCalled()
    expect(db.notification.createMany).toHaveBeenCalledOnce()
  })

  it.each([false, true])('handles no followers with notifyAuthor=%s', async (notifyAuthor) => {
    const db = database()

    await notifyArticlePublished(notificationDb(db), article, { notifyAuthor })

    expect(db.notification.create).toHaveBeenCalledTimes(notifyAuthor ? 1 : 0)
    expect(db.user.findUnique).toHaveBeenCalledTimes(notifyAuthor ? 1 : 0)
    expect(db.notification.createMany).not.toHaveBeenCalled()
  })

  it('falls back consistently when author metadata and recipient language are missing', async () => {
    const db = database()
    db.user.findUnique.mockResolvedValue(null)
    db.follow.findMany.mockResolvedValue([follower('reader-1', '')])

    await notifyArticlePublished(notificationDb(db), article, { notifyAuthor: true })

    expect(getTranslator.mock.calls).toEqual([['en']])
    expect(db.notification.create.mock.calls[0]![0].data.message).toBe(
      'en:common.notifications.articlePublished:Published article',
    )
    expect(db.notification.createMany.mock.calls[0]![0].data[0].message).toBe(
      'en:common.notifications.newArticleFromFollowed:Anonymous|Published article',
    )
  })

  it('batches large follower lists without dropping or repeating recipients', async () => {
    const db = database()
    const followers = Array.from({ length: 205 }, (_, index) => follower(`reader-${index}`))
    db.follow.findMany.mockResolvedValue(followers)

    await notifyArticlePublished(notificationDb(db), article)

    const batches = db.notification.createMany.mock.calls.map(([query]) => query.data)
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5])
    expect(batches.flat().map((notification) => notification.userId)).toEqual(
      followers.map((reader) => reader.followerId),
    )
    expect(getTranslator).toHaveBeenCalledExactlyOnceWith('en')
  })

  it('propagates write failures so the calling transaction can roll back', async () => {
    const db = database()
    db.follow.findMany.mockResolvedValue(Array.from({ length: 205 }, (_, index) => follower(`reader-${index}`)))
    db.notification.createMany.mockRejectedValueOnce(new Error('write failed'))

    await expect(notifyArticlePublished(notificationDb(db), article)).rejects.toThrow('write failed')
    expect(db.notification.createMany).toHaveBeenCalledOnce()
  })
})
