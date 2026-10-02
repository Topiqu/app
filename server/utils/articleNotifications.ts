import type { DatabaseClient } from './database'

type NotificationDatabase = Pick<DatabaseClient, 'user' | 'follow' | 'notification'>

export const notifyArticlePublished = async (
  db: NotificationDatabase,
  article: { id: string; title: string; userId: string },
  { notifyAuthor = false }: { notifyAuthor?: boolean } = {},
) => {
  const followers = await db.follow.findMany({
    where: { followedId: article.userId, follower: { allowNotifs: true } },
    select: { followerId: true, follower: { select: { language: true } } },
  })
  if (!notifyAuthor && !followers.length) return

  const author = await db.user.findUnique({
    where: { id: article.userId },
    select: { username: true, language: true },
  })
  const translators = new Map<string, ReturnType<typeof getServerTranslator>>()
  const translator = (language: string) => {
    if (!translators.has(language)) translators.set(language, getServerTranslator(language))
    return translators.get(language)!
  }

  if (notifyAuthor) {
    const translate = await translator(author?.language || 'en')
    await db.notification.create({
      data: {
        message: translate('common.notifications.articlePublished', [article.title])!,
        userId: article.userId,
        articleId: article.id,
        type: 'ARTICLE_PUBLISHED',
      },
    })
  }

  const messages = new Map(
    await Promise.all(
      [...new Set(followers.map((follower) => follower.follower.language || 'en'))].map(async (language) => {
        const translate = await translator(language)
        return [
          language,
          translate('common.notifications.newArticleFromFollowed', [author?.username ?? 'Anonymous', article.title])!,
        ] as const
      }),
    ),
  )
  const notifications = followers.map((follower) => ({
    message: messages.get(follower.follower.language || 'en')!,
    userId: follower.followerId,
    articleId: article.id,
    type: 'ARTICLE_PUBLISHED' as const,
  }))
  const batchSize = 100
  for (let i = 0; i < notifications.length; i += batchSize) {
    await db.notification.createMany({ data: notifications.slice(i, i + batchSize), skipDuplicates: true })
  }
}
