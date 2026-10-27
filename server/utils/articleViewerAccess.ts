import type { ArticleWhereInput } from '~~/generated/zenstack/input'

type ArticleViewer = {
  role?: string | null
  clientSiteId?: string | null
}

/**
 * Reading unpublished fields is an administrative capability, but an `admin` role only applies
 * inside its active tenant. On a foreign publication that same session is just a public reader.
 * Superadmins deliberately retain cross-tenant access.
 */
export const hasArticleAdminAccess = (viewer: ArticleViewer | null | undefined, clientSiteId: string) =>
  viewer?.role === 'superadmin' || (viewer?.role === 'admin' && viewer.clientSiteId === clientSiteId)

export const sessionTenantId = (viewer: ArticleViewer | null | undefined) =>
  viewer?.role === 'admin' || viewer?.role === 'superadmin' ? viewer.clientSiteId || undefined : undefined

/** Public exports and collections must not inherit administrative model read permissions. */
export const publicArticleWhere = (now = new Date()): ArticleWhereInput => ({
  status: 'published',
  deletedAt: null,
  clientSite: { deletedAt: null },
  OR: [{ releaseAt: null }, { releaseAt: { lte: now } }],
})

/**
 * Live to the public: published and past its release. Reader engagement (poll votes, likes,
 * feedback) opens only then, even for the admins who can already read a draft or a scheduled one.
 */
export const isArticleLive = (article: { status: string; releaseAt: Date | null }, now = new Date()) =>
  article.status === 'published' && (!article.releaseAt || article.releaseAt <= now)

/**
 * Engagement routes read through the policy, which also returns a published row before its release.
 * Before an article is live only its tenant's admins and its author may learn it exists; everyone
 * else must get the same 404 as for a missing id.
 */
export const canSeeUnreleasedArticle = (
  viewer: (ArticleViewer & { id?: string | null }) | null | undefined,
  article: { clientSiteId: string; userId: string | null; status: string; releaseAt: Date | null },
  now = new Date(),
) =>
  isArticleLive(article, now) ||
  hasArticleAdminAccess(viewer, article.clientSiteId) ||
  (!!viewer?.id && article.userId === viewer.id)

/** The fields `canReadArticle` and `isArticleLive` decide on. */
export const articleAccessSelect = {
  clientSiteId: true,
  status: true,
  deletedAt: true,
  releaseAt: true,
  clientSite: { select: { deletedAt: true } },
} as const

export const canReadArticle = (
  viewer: ArticleViewer | null | undefined,
  article: {
    clientSiteId: string
    status: string
    deletedAt: Date | null
    releaseAt: Date | null
    clientSite: { deletedAt: Date | null }
  },
  now = new Date(),
) =>
  !article.deletedAt &&
  !article.clientSite.deletedAt &&
  (hasArticleAdminAccess(viewer, article.clientSiteId) || isArticleLive(article, now))
