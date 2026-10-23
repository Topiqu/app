export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const { take, skip } = await getPagination(event)
  const db = await getEnhancedPrisma(user)

  const tag = await db.tag.findUnique({
    where: { id, deletedAt: null, OR: [{ clientSiteId: null }, { clientSite: { deletedAt: null } }] },
    select: { id: true, clientSiteId: true },
  })
  if (!tag) throw createError({ statusCode: 404, message: t('common.errors.tagNotFound')! })

  const publicWhere = publicArticleWhere()
  const previewTenantId = user.role === 'admin' ? user.clientSiteId : null
  // Filter at the article root: an unreadable relation must not become a null join after paging.
  const articles = await db.article.findMany({
    where: {
      deletedAt: null,
      clientSite: { deletedAt: null },
      tags: { some: { tagId: id } },
      ...(user.role === 'superadmin'
        ? {}
        : previewTenantId
          ? { OR: [publicWhere, { clientSiteId: previewTenantId }] }
          : publicWhere),
    },
    take,
    skip,
    select: articleCardSelect(user.id),
  })

  return {
    ...tag,
    articles: articles.map(({ reactions: _reactions, ...article }) => ({
      ...article,
      tags: article.tags.map((tag) => tag.tag),
      likes: article._count.reactions,
      comments: article._count.comments,
    })),
  }
})
