const BodySchema = z.object({
  visitorId: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const user = (await getServerSession(event))?.user
  const body = await readValidatedBody(event, BodySchema.parse)
  const clientFingerprint = body.visitorId

  if (!user && !clientFingerprint) {
    throw createError({ statusCode: 400, message: 'Missing visitor identification' })
  }

  const sessionId = user ? null : clientFingerprint
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
