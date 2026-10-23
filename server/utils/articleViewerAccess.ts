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
  (hasArticleAdminAccess(viewer, article.clientSiteId) ||
    (article.status === 'published' && (!article.releaseAt || article.releaseAt <= now)))
