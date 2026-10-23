import { vi } from 'vitest'
import { createError } from 'h3'

export const storedComment = (id: string, parentId: string | null = null, articleId = 'article-1', position = 0) => ({
  id,
  parentId,
  articleId,
  userId: 'reader-1',
  content: `Comment ${id}`,
  gifUrl: null as string | null,
  deletedAt: null as Date | null,
  createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, position)),
  user: null as {
    username: string
    avatarUrl: string | null
    bio: string | null
    bans: { reason: string; expiresAt: Date | null }[]
  } | null,
  reactions: [] as { userId: string; type: 'LIKE' | 'DISLIKE' }[],
})
type StoredComment = ReturnType<typeof storedComment>
interface Filter {
  articleId?: string
  id?: string | { in: string[] }
  parentId?: null | string | { in: string[] }
}
const matches = (row: StoredComment, where: Filter) =>
  (!where.articleId || row.articleId === where.articleId) &&
  (!where.id || (typeof where.id === 'string' ? row.id === where.id : where.id.in.includes(row.id))) &&
  (where.parentId === undefined ||
    (typeof where.parentId === 'object' && where.parentId !== null
      ? where.parentId.in.includes(row.parentId ?? '')
      : row.parentId === where.parentId))

export const commentReadFixture = async (
  options: {
    comments?: StoredComment[]
    article?: Partial<{
      status: string
      deletedAt: Date | null
      releaseAt: Date | null
      clientSite: { deletedAt: Date | null; commentGifsEnabled: boolean }
    }>
    viewer?: { id: string; role: string; clientSiteId?: string } | null
    query?: Record<string, unknown>
    pagination?: { skip: number; take: number }
    team?: string[]
  } = {},
) => {
  const comments = options.comments ?? [storedComment('root')]
  const article = {
    clientSiteId: 'site-1',
    status: 'published',
    deletedAt: null,
    releaseAt: null,
    clientSite: { deletedAt: null, commentGifsEnabled: true },
    ...options.article,
  }
  const query = options.query ?? {}
  const pagination = options.pagination ?? { skip: 0, take: 5 }
  const viewer = options.viewer ?? null
  const db = {
    article: { findUnique: vi.fn().mockResolvedValue(article) },
    comment: {
      findFirst: vi.fn(async ({ where }: { where: Filter }) => comments.find((row) => matches(row, where)) ?? null),
      findMany: vi.fn(
        async ({
          where,
          skip = 0,
          take,
          cursor,
          orderBy,
        }: {
          where: Filter
          skip?: number
          take: number
          cursor?: { id: string }
          orderBy: { createdAt?: string }[]
        }) => {
          const matching = comments
            .filter((row) => matches(row, where))
            .sort(
              (a, b) =>
                (+a.createdAt - +b.createdAt || a.id.localeCompare(b.id)) * (orderBy[0]?.createdAt === 'desc' ? -1 : 1),
            )
          const offset = cursor ? matching.findIndex((row) => row.id === cursor.id) + skip : skip
          return matching.slice(offset, offset + take).map((row) => ({
            ...row,
            _count: {
              replies: comments.filter((child) => child.parentId === row.id && child.articleId === row.articleId)
                .length,
            },
            reactions: row.reactions.filter((reaction) => reaction.userId === viewer?.id).slice(0, 1),
          }))
        },
      ),
      count: vi.fn(async ({ where }: { where: Filter }) => comments.filter((row) => matches(row, where)).length),
    },
    commentReaction: {
      groupBy: vi.fn(
        async ({
          where,
          by,
        }: {
          where: { commentId: { in: string[] }; type?: string; userId?: { in: string[] } }
          by: string[]
        }) => {
          const groups = new Map<
            string,
            { commentId: string; type: 'LIKE' | 'DISLIKE'; _count: { commentId: number } }
          >()
          for (const row of comments) {
            if (!where.commentId.in.includes(row.id)) continue
            for (const reaction of row.reactions) {
              if (
                (where.type && reaction.type !== where.type) ||
                (where.userId && !where.userId.in.includes(reaction.userId))
              )
                continue
              const key = `${row.id}:${by.includes('type') ? reaction.type : ''}`
              const group = groups.get(key) ?? { commentId: row.id, type: reaction.type, _count: { commentId: 0 } }
              group._count.commentId++
              groups.set(key, group)
            }
          }
          return [...groups.values()]
        },
      ),
    },
    emojiReaction: { groupBy: vi.fn().mockResolvedValue([]) },
    emoji: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn(async (_sql: TemplateStringsArray, articleId: string, take: number, skip: number) => {
      const likes = (row: StoredComment) => row.reactions.filter((reaction) => reaction.type === 'LIKE').length
      return comments
        .filter((row) => row.articleId === articleId && row.parentId === null)
        .sort((a, b) => likes(b) - likes(a) || +b.createdAt - +a.createdAt || b.id.localeCompare(a.id))
        .slice(skip, skip + take)
        .map(({ id }) => ({ id }))
    }),
  }
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useServerI18n', async () => ({ translate: (key: string) => key }))
  vi.stubGlobal('getRouterParam', () => 'article-1')
  vi.stubGlobal('getSessionUser', async () => viewer)
  vi.stubGlobal('getEnhancedPrisma', async () => db)
  vi.stubGlobal('getPagination', async () => pagination)
  vi.stubGlobal('getQuery', () => query)
  vi.stubGlobal('requireTenantMember', async () => ({ membership: {} }))
  vi.stubGlobal('hasTenantScope', () => true)
  vi.stubGlobal('prisma', {
    tenantMembership: { findMany: vi.fn().mockResolvedValue((options.team ?? []).map((userId) => ({ userId }))) },
  })
  const handler = (await import('../../../server/api/comments/[id]/index.get')).default
  return { run: () => handler({} as never), db, comments, article, query, pagination }
}
