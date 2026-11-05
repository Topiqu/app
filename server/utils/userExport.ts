import type { getEnhancedPrisma } from './zenstack'

type ExportDb = Awaited<ReturnType<typeof getEnhancedPrisma>>
type Page = (skip: number, take: number) => Promise<object[]>

export const USER_EXPORT_BATCH_SIZE = 100

/** The audit actions that describe the account's own sign-ins and credential changes. */
export const SECURITY_EVENT_ACTIONS = [
  'SESSION_CREATE',
  'SESSION_REVOKE',
  'SESSIONS_REVOKE_OTHERS',
  'PASSWORD_CHANGE',
  'PASSWORD_SET',
  'ROLE_CHANGE',
]

export const USER_EXPORT_ACCOUNT_SELECT = {
  id: true,
  username: true,
  email: true,
  bio: true,
  avatarUrl: true,
  role: true,
  language: true,
  theme: true,
  emailVerified: true,
  allowNotifs: true,
  allowEmail: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
} as const

// Every select is explicit so a new column, especially a secret, never reaches the file by accident.
const exportSections = (db: ExportDb, userId: string, ownedSiteIds: string[]): Record<string, Page> => {
  const createdOrOwned = { OR: [{ createdById: userId }, { clientSiteId: { in: ownedSiteIds } }] }

  return {
    connectedAccounts: (skip, take) =>
      db.account.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: { providerId: true, accountId: true, scope: true, createdAt: true },
      }),
    memberships: (skip, take) =>
      db.tenantMembership.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: {
          clientSiteId: true,
          role: true,
          scopes: true,
          createdAt: true,
          deletedAt: true,
          clientSite: { select: { name: true, domain: true } },
        },
      }),
    // An owner's blog also holds AI-written and teammates' articles, which ToS §4 treats as the customer's content.
    articles: async (skip, take) => {
      const rows = await db.article.findMany({
        where: { OR: [{ userId }, { clientSiteId: { in: ownedSiteIds }, deletedAt: null }] },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: {
          id: true,
          userId: true,
          clientSiteId: true,
          language: true,
          slug: true,
          title: true,
          excerpt: true,
          content: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      })
      return rows.map(({ userId: authorId, ...row }) => ({ ...row, authoredByYou: authorId === userId }))
    },
    articleDrafts: (skip, take) =>
      db.articleDraft.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: {
          id: true,
          clientSiteId: true,
          title: true,
          excerpt: true,
          content: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    comments: (skip, take) =>
      db.comment.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: {
          id: true,
          articleId: true,
          parentId: true,
          content: true,
          gifUrl: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
    commentReactions: (skip, take) =>
      db.commentReaction.findMany({
        where: { userId },
        orderBy: { commentId: 'asc' },
        skip,
        take,
        select: { commentId: true, type: true },
      }),
    commentEmojiReactions: (skip, take) =>
      db.emojiReaction.findMany({
        where: { userId },
        orderBy: [{ commentId: 'asc' }, { emojiId: 'asc' }],
        skip,
        take,
        select: { commentId: true, emojiId: true },
      }),
    articleReactions: (skip, take) =>
      db.articleReaction.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: { articleId: true, createdAt: true },
      }),
    articleFeedback: (skip, take) =>
      db.articleFeedback.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: { articleId: true, isHelpful: true, reason: true, createdAt: true },
      }),
    articleShares: (skip, take) =>
      db.articleShare.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: { articleId: true, platform: true, createdAt: true },
      }),
    articleViews: (skip, take) =>
      db.articleView.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: { articleId: true, viewedOn: true },
      }),
    pollVotes: (skip, take) =>
      db.pollResult.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: { articleId: true, pollId: true, optionId: true, createdAt: true },
      }),
    following: (skip, take) =>
      db.follow.findMany({
        where: { followerId: userId },
        orderBy: { followedId: 'asc' },
        skip,
        take,
        select: { followedId: true, createdAt: true },
      }),
    notifications: (skip, take) =>
      db.notification.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: { type: true, message: true, isRead: true, link: true, createdAt: true },
      }),
    media: (skip, take) =>
      db.mediaAsset.findMany({
        where: createdOrOwned,
        orderBy: { id: 'asc' },
        skip,
        take,
        select: {
          id: true,
          clientSiteId: true,
          url: true,
          name: true,
          defaultAltText: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          width: true,
          height: true,
          sourceUrl: true,
          author: true,
          license: true,
          licenseUrl: true,
          attribution: true,
          archivedAt: true,
          createdAt: true,
        },
      }),
    // A former member wrote some of this, but it is the blog's data once they have left.
    knowledgeSources: (skip, take) =>
      db.knowledgeSource.findMany({
        where: {
          OR: [
            { createdById: userId, clientSite: { tenantMemberships: { some: { userId, deletedAt: null } } } },
            { clientSiteId: { in: ownedSiteIds } },
          ],
        },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: {
          id: true,
          clientSiteId: true,
          kind: true,
          title: true,
          status: true,
          publicUrl: true,
          sourceUrl: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          content: true,
          createdAt: true,
        },
      }),
    apiKeys: (skip, take) =>
      db.apiKey.findMany({
        where: { createdById: userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: {
          id: true,
          clientSiteId: true,
          name: true,
          prefix: true,
          scopes: true,
          lastUsedAt: true,
          revokedAt: true,
          createdAt: true,
        },
      }),
    sessions: (skip, take) =>
      db.session.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: {
          ip: true,
          userAgent: true,
          device: true,
          os: true,
          browser: true,
          city: true,
          region: true,
          country: true,
          origin: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      }),
    // Audit metadata also carries session IDs, target user IDs and roles, so only these fields leave it.
    securityEvents: async (skip, take) => {
      const rows = await db.log.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: { action: true, createdAt: true, ip: true, metadata: true },
      })
      return rows.map(({ metadata, ...row }) => {
        const meta = ((typeof metadata === 'string' ? JSON.parse(metadata) : metadata) ?? {}) as Record<string, unknown>
        return {
          ...row,
          // Other audit rows store the IP of whoever acted, such as an invitee or an API caller.
          ip: SECURITY_EVENT_ACTIONS.includes(row.action) ? row.ip : null,
          device: meta.device ?? null,
          os: meta.os ?? null,
          browser: meta.browser ?? null,
          city: meta.city ?? null,
          country: meta.country ?? null,
        }
      })
    },
    bans: (skip, take) =>
      db.userBan.findMany({
        where: { userId },
        orderBy: { id: 'asc' },
        skip,
        take,
        select: { clientSiteId: true, reason: true, expiresAt: true, createdAt: true },
      }),
  }
}

export async function* userExportChunks(db: ExportDb, account: { id: string }): AsyncGenerator<string> {
  const owned = await db.tenantMembership.findMany({
    where: { userId: account.id, role: 'OWNER', deletedAt: null },
    select: { clientSiteId: true },
  })

  yield `{"format":"topiqu-account-export","version":1,"exportedAt":${JSON.stringify(new Date())},"account":${JSON.stringify(account)}`

  const sections = exportSections(
    db,
    account.id,
    owned.map(({ clientSiteId }) => clientSiteId),
  )
  for (const [name, page] of Object.entries(sections)) {
    yield `,${JSON.stringify(name)}:[`
    let separator = ''
    for (let skip = 0; ; skip += USER_EXPORT_BATCH_SIZE) {
      const rows = await page(skip, USER_EXPORT_BATCH_SIZE)
      for (const row of rows) {
        yield separator + JSON.stringify(row)
        separator = ','
      }
      if (rows.length < USER_EXPORT_BATCH_SIZE) break
    }
    yield ']'
  }
  yield '}'
}

/** A failed read errors the stream, so the browser rejects the download rather than saving a truncated file. */
export const userExportStream = (db: ExportDb, account: { id: string }) => {
  const chunks = userExportChunks(db, account)
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await chunks.next()
      if (done) controller.close()
      else controller.enqueue(encoder.encode(value))
    },
    async cancel() {
      await chunks.return(undefined)
    },
  })
}
