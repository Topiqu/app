import type { CommentPage, CommentWithReplies } from '~~/types/comment'

import { z } from 'zod'
import {
  COMMENT_CONTEXT_LIMIT,
  COMMENT_INITIAL_REPLY_DEPTH,
  COMMENT_REPLY_PAGE_LIMIT,
  COMMENT_ROOT_PAGE_LIMIT,
  COMMENT_THREAD_NODE_LIMIT,
} from '~~/shared/utils/commentThreads'

import { canReadArticle } from '../../../utils/articleViewerAccess'

const querySchema = z
  .object({
    sort: z.enum(['createdAt:asc', 'createdAt:desc', 'likes:desc']).optional(),
    target: z.string().min(1).max(128).optional(),
    parent: z.string().min(1).max(128).optional(),
    cursor: z.string().min(1).max(128).optional(),
  })
  .refine((query) => !(query.target && query.parent) && (!query.cursor || !!query.parent))

export default defineEventHandler(async (event): Promise<CommentPage> => {
  const { translate: t } = await useServerI18n(event)
  const articleId = getRouterParam(event, 'id')
  if (!articleId) throw createError({ statusCode: 400, message: t('common.errors.articleIdRequired')! })
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  const { sort, target, parent, cursor } = parsed.data

  const user = await getSessionUser(event)
  const db = await getEnhancedPrisma(user)
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: {
      clientSiteId: true,
      status: true,
      deletedAt: true,
      releaseAt: true,
      clientSite: { select: { commentGifsEnabled: true, deletedAt: true } },
    },
  })
  const now = new Date()
  if (!article || !canReadArticle(user, article, now))
    throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  const canModerate =
    user?.role === 'superadmin' ||
    (user?.role === 'admin' &&
      user.clientSiteId === article.clientSiteId &&
      hasTenantScope((await requireTenantMember(event)).membership, 'CONTENT_MODERATE'))
  const findComments = (
    where: { parentId?: null | { in: string[] }; id?: { in: string[] } },
    options: { take: number; skip?: number; descending?: boolean; cursor?: string } = {
      take: COMMENT_THREAD_NODE_LIMIT,
    },
  ) =>
    db.comment.findMany({
      where: { articleId, ...where },
      orderBy: [{ createdAt: options.descending ? 'desc' : 'asc' }, { id: options.descending ? 'desc' : 'asc' }],
      take: options.take,
      skip: options.cursor ? 1 : options.skip,
      ...(options.cursor ? { cursor: { id: options.cursor } } : {}),
      select: {
        id: true,
        content: true,
        gifUrl: true,
        createdAt: true,
        userId: true,
        parentId: true,
        deletedAt: true,
        articleId: true,
        _count: { select: { replies: { where: { articleId } } } },
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
        reactions: { where: { userId: user?.id ?? '' }, select: { type: true }, take: user ? 1 : 0 },
      },
    })

  let roots: Awaited<ReturnType<typeof findComments>> = []
  let path: typeof roots = []
  let hasMore = false
  let contextParentId: string | undefined
  let parentPage: CommentPage['parent']
  const childCursors = new Map<string, string>()

  if (parent) {
    const found = await db.comment.findFirst({ where: { id: parent, articleId }, select: { id: true } })
    if (!found) throw createError({ statusCode: 404, message: t('common.errors.commentNotFound')! })
    if (
      cursor &&
      !(await db.comment.findFirst({ where: { id: cursor, parentId: parent, articleId }, select: { id: true } }))
    )
      throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
    const page = await findComments({ parentId: { in: [parent] } }, { take: COMMENT_REPLY_PAGE_LIMIT + 1, cursor })
    roots = page.slice(0, COMMENT_REPLY_PAGE_LIMIT)
    parentPage = {
      id: parent,
      cursor: roots.at(-1)?.id ?? cursor ?? null,
      hasMore: page.length > COMMENT_REPLY_PAGE_LIMIT,
    }
  } else if (target) {
    const ids: string[] = []
    const visited = new Set<string>()
    let id: string | null = target
    while (id && !visited.has(id) && ids.length < COMMENT_CONTEXT_LIMIT) {
      const found: { id: string; parentId: string | null } | null = await db.comment.findFirst({
        where: { id, articleId },
        select: { id: true, parentId: true },
      })
      if (!found) return { comments: [], hasMore: false }
      ids.push(found.id)
      visited.add(found.id)
      id = found.parentId
    }
    if (id && !visited.has(id)) contextParentId = id
    const rows = await findComments({ id: { in: ids } })
    const index = new Map(rows.map((row) => [row.id, row]))
    path = ids.reverse().flatMap((id) => index.get(id) ?? [])
    roots = path.length ? [path[0]!] : []
  } else {
    const pagination = await getPagination(event)
    const take = Math.min(pagination.take, COMMENT_ROOT_PAGE_LIMIT)
    const skip = (pagination.skip / pagination.take) * take
    if (sort === 'likes:desc') {
      // Access was checked above; this read-only aggregate selects ids from this article only.
      // The bounded ids are loaded through the policy-enhanced client below.
      const ranked = await db.$queryRaw<{ id: string }[]>`
        SELECT c."id" FROM "Comment" c
        LEFT JOIN "CommentReaction" r ON r."commentId" = c."id" AND r."type" = 'LIKE'
        WHERE c."articleId" = ${articleId} AND c."parentId" IS NULL
        GROUP BY c."id", c."createdAt"
        ORDER BY COUNT(r."userId") DESC, c."createdAt" DESC, c."id" DESC
        LIMIT ${take} OFFSET ${skip}
      `
      const rows = await findComments({ id: { in: ranked.map((row) => row.id) }, parentId: null })
      const index = new Map(rows.map((row) => [row.id, row]))
      roots = ranked.flatMap((row) => index.get(row.id) ?? [])
    } else roots = await findComments({ parentId: null }, { take, skip, descending: sort !== 'createdAt:asc' })
    const total = await db.comment.count({ where: { articleId, parentId: null } })
    hasMore = skip + roots.length < total
  }

  const rows = new Map([...roots, ...path].map((row) => [row.id, row]))
  const rootIds = new Set(roots.map((row) => row.id))
  let frontier = roots
  for (
    let depth = 1;
    depth < COMMENT_INITIAL_REPLY_DEPTH && frontier.length && rows.size < COMMENT_THREAD_NODE_LIMIT;
    depth++
  ) {
    const children = await findComments(
      { parentId: { in: frontier.map((row) => row.id) } },
      { take: COMMENT_THREAD_NODE_LIMIT - rows.size },
    )
    for (const child of children) {
      if (child.parentId) childCursors.set(child.parentId, child.id)
      if (!rows.has(child.id)) rows.set(child.id, child)
    }
    frontier = children
  }

  const ids = [...rows.keys()]
  // Membership ids are system-scoped; only aggregate publication-like counts leave this route.
  const team = ids.length
    ? await prisma.tenantMembership.findMany({
        where: { clientSiteId: article.clientSiteId, deletedAt: null },
        select: { userId: true },
      })
    : []
  const [reactions, publicationReactions, emojiReactions] = ids.length
    ? await Promise.all([
        db.commentReaction.groupBy({
          by: ['commentId', 'type'],
          where: { commentId: { in: ids }, comment: { articleId } },
          _count: { commentId: true },
        }),
        team.length
          ? db.commentReaction.groupBy({
              by: ['commentId'],
              where: {
                commentId: { in: ids },
                comment: { articleId },
                type: 'LIKE',
                userId: { in: team.map((member) => member.userId) },
              },
              _count: { commentId: true },
            })
          : [],
        db.emojiReaction.groupBy({
          by: ['commentId', 'emojiId'],
          where: { commentId: { in: ids }, comment: { articleId }, emoji: { clientSiteId: article.clientSiteId } },
          _count: { emojiId: true },
        }),
      ])
    : [[], [], []]
  const reactionCounts = new Map<string, { likes: number; dislikes: number }>()
  for (const reaction of reactions) {
    const count = reactionCounts.get(reaction.commentId) ?? { likes: 0, dislikes: 0 }
    count[reaction.type === 'LIKE' ? 'likes' : 'dislikes'] = reaction._count.commentId
    reactionCounts.set(reaction.commentId, count)
  }
  const publicationLikes = new Map(
    publicationReactions.map((reaction) => [reaction.commentId, reaction._count.commentId]),
  )
  const emojis = emojiReactions.length
    ? await db.emoji.findMany({
        where: {
          id: { in: [...new Set(emojiReactions.map((reaction) => reaction.emojiId))] },
          clientSiteId: article.clientSiteId,
        },
        select: { id: true, imageUrl: true, shortcode: true },
      })
    : []
  const emojiById = new Map(emojis.map((emoji) => [emoji.id, emoji]))
  const emojisByComment = new Map<string, CommentWithReplies['emojiReactions']>()
  for (const reaction of emojiReactions) {
    const emoji = emojiById.get(reaction.emojiId)
    if (!emoji) continue
    const counts = emojisByComment.get(reaction.commentId) ?? []
    counts.push({
      emojiId: emoji.id,
      count: reaction._count.emojiId,
      emoji: { imageUrl: emoji.imageUrl, shortcode: emoji.shortcode },
    })
    emojisByComment.set(reaction.commentId, counts)
  }

  const dtos = new Map<string, CommentWithReplies>()
  for (const comment of rows.values()) {
    const deleted = !!comment.deletedAt
    const ban = comment.user?.bans[0]
    const counts = reactionCounts.get(comment.id) ?? { likes: 0, dislikes: 0 }
    dtos.set(comment.id, {
      id: comment.id,
      content: deleted ? '' : comment.content,
      gifUrl: deleted || article.clientSite.commentGifsEnabled === false ? null : comment.gifUrl,
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
      ...counts,
      replies: [],
      repliesHasMore: false,
      repliesCursor: childCursors.get(comment.id) ?? null,
      userReaction: deleted ? null : (comment.reactions[0] ?? null),
      emojiReactions: deleted ? [] : (emojisByComment.get(comment.id) ?? []),
      depth: 1,
      publicationLikes: deleted ? 0 : (publicationLikes.get(comment.id) ?? 0),
    })
  }
  for (const comment of dtos.values()) {
    if (!rootIds.has(comment.id) && comment.parentId) dtos.get(comment.parentId)?.replies.push(comment)
  }
  for (const [id, dto] of dtos) {
    dto.replies.sort((a, b) => +a.createdAt - +b.createdAt || a.id.localeCompare(b.id))
    dto.repliesHasMore = rows.get(id)!._count.replies > dto.replies.length
  }
  const comments = roots.flatMap((root) => dtos.get(root.id) ?? [])
  if (contextParentId && comments[0]) comments[0].contextParentId = contextParentId
  const visited = new Set<string>()
  const pending = [...comments]
  for (let position = 0; position < pending.length; position++) {
    const dto = pending[position]!
    visited.add(dto.id)
    dto.replies = dto.replies.filter((reply) => !visited.has(reply.id))
    for (const reply of dto.replies) {
      reply.depth = dto.depth + 1
      pending.push(reply)
    }
  }
  return { comments, hasMore, ...(parentPage ? { parent: parentPage } : {}) }
})
