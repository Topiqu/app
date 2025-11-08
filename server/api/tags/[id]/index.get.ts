export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { take, skip } = await getPagination(event)
  const db = await getEnhancedPrisma(user)

  const tag = await db.tag.findUnique({
    where: { id },
    select: { id: true, clientSiteId: true },
  })
  if (!tag) throw createError({ statusCode: 404, message: t('common.errors.tagNotFound')! })

  const articles = await db.articleTag.findMany({
    where: { tagId: id },
    take,
    skip,
    include: {
      article: {
        include: {
          tags: { include: { tag: true } },
          user: { select: { id: true, username: true, email: true, role: true, avatarUrl: true } },
          _count: { select: { comments: true, reactions: true } },
        },
      },
    },
  })

  return {
    ...tag,
    articles: articles.map((a) => ({
      ...a.article,
      tags: a.article.tags.map((t) => t.tag),
      user: a.article.user,
      likes: a.article._count.reactions,
      comments: a.article._count.comments,
    })),
  }
})
