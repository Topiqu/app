import { createError } from 'h3'

type StaffIdentity = { role?: string | null; clientSiteId?: string | null }
type ArticleIdentity = { clientSiteId: string }

export const assertArticleAdminAccess = (
  user: StaffIdentity | null | undefined,
  article: ArticleIdentity,
  messages: { unauthorized: string; forbidden: string },
) => {
  if (!user) throw createError({ statusCode: 401, message: messages.unauthorized })
  if (user.role === 'superadmin') return
  if (user.role !== 'admin' || !user.clientSiteId || user.clientSiteId !== article.clientSiteId) {
    throw createError({ statusCode: 403, message: messages.forbidden })
  }
}
