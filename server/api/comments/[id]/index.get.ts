import type { CommentWithReplies } from '~~/types/comment'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.articleIdRequired')! })

  const user = (await getServerSession(event))?.user
  const db = await getEnhancedPrisma(user)

  const article = await db.article.findUnique({ where: { id: articleId }, select: { clientSiteId: true } })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const pagination = await getPagination(event)
  // Capped page size; the offset is rescaled so a larger requested `limit` cannot skip rows.
  const take = Math.min(pagination.take, 5)
  const skip = (pagination.skip / pagination.take) * take
  const { sort } = getQuery(event)
  const canModerate =
    user?.role === 'superadmin' || (user?.role === 'admin' && user.clientSiteId === article.clientSiteId)

  const now = new Date()
  const findComments = (
    where: { parentId?: null | { in: string[] }; id?: { in: string[] } },
    page?: { skip: number; take: number },
  ) =>
    db.comment.findMany({
      where: { articleId, ...where },
      orderBy: { createdAt: page && sort !== 'createdAt:asc' ? 'desc' : 'asc' },
      skip: page?.skip,
      take: page?.take,
      select: {
        id: true,
        content: true,
        gifUrl: true,
        createdAt: true,
        userId: true,
        parentId: true,
        deletedAt: true,
        articleId: true,
        user: {
          select: {
            username: true,
            avatarUrl: true,
            bio: true,
            bans: {
              where: {
                clientSiteId: article.clientSiteId,
                deletedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
              select: { reason: true, expiresAt: true },
              take: 1,
            },
          },
        },
        reactions: { select: { type: true, userId: true } },
        emojiReactions: { select: { emojiId: true, emoji: { select: { imageUrl: true, shortcode: true } } } },
      },
    })

  // A like count cannot be an ORDER BY key, so rank the (id-only) roots in memory and load just the page.
  const rootsByLikes = async () => {
    const ranked = await db.comment.findMany({
      where: { articleId, parentId: null },
      select: { id: true, createdAt: true, _count: { select: { reactions: { where: { type: 'LIKE' } } } } },
    })
    ranked.sort((a, b) => b._count.reactions - a._count.reactions || +b.createdAt - +a.createdAt)
    const ids = ranked.slice(skip, skip + take).map((c) => c.id)
    const page = await findComments({ id: { in: ids } })
    return { roots: ids.flatMap((id) => page.filter((c) => c.id === id)), total: ranked.length }
  }

  const { roots, total } =
    sort === 'likes:desc'
      ? await rootsByLikes()
      : await Promise.all([
          findComments({ parentId: null }, { skip, take }),
          db.comment.count({ where: { articleId, parentId: null } }),
        ]).then(([roots, total]) => ({ roots, total }))

  // Replies are fetched level by level for this page's roots only, never for the whole article.
  const replies: typeof roots = []
  for (let parents = roots; parents.length;) {
    parents = await findComments({ parentId: { in: parents.map((c) => c.id) } })
    replies.push(...parents)
  }

  // System-scoped: membership rows are not readable by an anonymous visitor, and only ids leave this query.
  const team = new Set(
    (
      await prisma.tenantMembership.findMany({
        where: { clientSiteId: article.clientSiteId, deletedAt: null },
        select: { userId: true },
      })
    ).map((m) => m.userId),
  )

  const toDto = (comment: (typeof roots)[number], depth: number): CommentWithReplies => {
    const isDeleted = !!comment.deletedAt
    const ban = comment.user?.bans[0]
    const likes = comment.reactions.filter((r) => r.type === 'LIKE')
    const own = user ? comment.reactions.find((r) => r.userId === user.id) : undefined
    const emoji = new Map<string, CommentWithReplies['emojiReactions'][number]>()
    for (const r of comment.emojiReactions) {
      const entry = emoji.get(r.emojiId) ?? { emojiId: r.emojiId, count: 0, emoji: r.emoji }
      entry.count++
      emoji.set(r.emojiId, entry)
    }

    return {
      id: comment.id,
      content: isDeleted ? '' : comment.content,
      gifUrl: isDeleted ? null : comment.gifUrl,
      createdAt: comment.createdAt,
      userId: comment.userId,
      parentId: comment.parentId,
      deletedAt: comment.deletedAt,
      articleId: comment.articleId,
      user: comment.user
        ? {
            username: comment.user.username,
            avatarUrl: comment.user.avatarUrl ?? undefined,
            bio: comment.user.bio ?? undefined,
            isBanned: !!ban,
            banDetails:
              ban && canModerate
                ? { reason: ban.reason ?? undefined, expiresAt: ban.expiresAt?.toISOString() }
                : undefined,
          }
        : null,
      article: { clientSiteId: article.clientSiteId },
      likes: likes.length,
      dislikes: comment.reactions.length - likes.length,
      replies: replies.filter((r) => r.parentId === comment.id).map((r) => toDto(r, depth + 1)),
      userReaction: isDeleted || !own ? null : { type: own.type },
      emojiReactions: isDeleted ? [] : [...emoji.values()],
      depth,
      publicationLikes: isDeleted ? 0 : likes.filter((r) => team.has(r.userId)).length,
    }
  }

  return {
    comments: roots.map((c) => toDto(c, 1)),
    hasMore: skip + roots.length < total,
  }
})
