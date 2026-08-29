// Anonymous likes are the only farmable path — a signed-in reader owns exactly one row per article,
// so toggling it moves nothing. Both budgets key off the IP because it is the one part of the
// request the caller does not choose; the per-article cap is loose enough for an office behind one
// NAT and still far below what it takes to move a number.
const PER_ARTICLE = { limit: 10, window: 24 * 60 * 60 }
const PER_IP = { limit: 60, window: 60 * 60 }

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const user = (await getServerSession(event))?.user
  // Was the client's FingerprintJS visitorId, read from the body — which let a caller pick its own
  // identity (rotate it and inflate the count) and never matched the cookie every read resolves.
  const sessionId = user ? null : issueAnonSession(event)
  const db = await getEnhancedPrisma(user)

  const where = user?.id
    ? { articleId: id, userId: user.id, sessionId: null }
    : { articleId: id, userId: null, sessionId }

  const exists = await db.articleReaction.findFirst({ where })

  if (exists) {
    await db.articleReaction.deleteMany({ where })
    const count = await db.articleReaction.count({ where: { articleId: id } })
    return { liked: false, likes: count }
  }

  // Only the create path is metered: taking a like back never inflates a count, and blocking it
  // would strand a reader on a like they no longer want.
  if (!user) {
    const ip = ipKey(event)
    const [articleAllowed, ipAllowed] = await Promise.all([
      consumeRateLimit(`reaction:article:${id}:${ip}`, PER_ARTICLE.limit, PER_ARTICLE.window),
      consumeRateLimit(`reaction:ip:${ip}`, PER_IP.limit, PER_IP.window),
    ])
    if (!articleAllowed || !ipAllowed) {
      throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
    }
  }

  const article = await db.article.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  await db.articleReaction.create({
    data: {
      articleId: id,
      userId: user?.id || null,
      sessionId,
    },
  })

  if (article.userId && article.userId !== user?.id) {
    await prisma.notification.create({
      data: {
        message: user?.name
          ? t('common.notifications.userLikedArticle', [user.name])!
          : t('common.notifications.anonymousLikedArticle')!,
        userId: article.userId,
        articleId: id,
        type: 'LIKE',
      },
    })
  }

  const count = await db.articleReaction.count({ where: { articleId: id } })
  return { liked: true, likes: count }
})
