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
