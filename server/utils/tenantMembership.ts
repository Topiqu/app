import type { H3Event } from 'h3'
import type { TenantScope } from '@prisma/client'

export const TENANT_SCOPES = [
  'ARTICLE_WRITE',
  'ARTICLE_WRITE_OTHERS',
  'ARTICLE_PUBLISH',
  'MEMBER_CONTROL',
  'TENANT_SETTINGS',
  'INTEGRATION_CONTROL',
  'BILLING_CHANGE',
  'API_KEY_CONTROL',
  'AI_USE',
  'ANALYTICS_READ',
  'CONTENT_MODERATE',
] as const satisfies readonly TenantScope[]

export type TenantAccess = {
  user: Awaited<ReturnType<typeof requireUser>>
  membership: { id: string; clientSiteId: string; userId: string; role: 'OWNER' | 'MEMBER'; scopes: TenantScope[] }
}

export const requireTenantMember = async (event: H3Event, clientSiteId?: string): Promise<TenantAccess> => {
  const user = await requireUser(event)
  const tenantId = clientSiteId ?? user.clientSiteId
  if (user.role === 'superadmin')
    return {
      user,
      membership: {
        id: 'superadmin',
        clientSiteId: tenantId,
        userId: user.id,
        role: 'OWNER',
        scopes: [...TENANT_SCOPES],
      },
    }
  if (!tenantId) throw createError({ statusCode: 403, message: 'No active tenant' })
  const membership = await prisma.tenantMembership.findUnique({
    where: { clientSiteId_userId: { clientSiteId: tenantId, userId: user.id } },
    select: { id: true, clientSiteId: true, userId: true, role: true, scopes: true, deletedAt: true },
  })
  if (!membership || membership.deletedAt) throw createError({ statusCode: 403, message: 'Tenant membership required' })
  return { user, membership }
}

export const requireTenantScope = async (event: H3Event, scope: TenantScope, clientSiteId?: string) => {
  const access = await requireTenantMember(event, clientSiteId)
  if (access.membership.role !== 'OWNER' && !access.membership.scopes.includes(scope))
    throw createError({ statusCode: 403, message: `Missing tenant scope: ${scope}` })
  return access
}

export const hasTenantScope = (membership: Pick<TenantAccess['membership'], 'role' | 'scopes'>, scope: TenantScope) =>
  membership.role === 'OWNER' || membership.scopes.includes(scope)

export const requireArticleAccess = async (event: H3Event, articleId: string) => {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { userId: true, clientSiteId: true },
  })
  if (!article) throw createError({ statusCode: 404, message: 'Article not found' })
  const access = await requireTenantScope(event, 'ARTICLE_WRITE', article.clientSiteId)
  if (article.userId !== access.user.id && !hasTenantScope(access.membership, 'ARTICLE_WRITE_OTHERS'))
    throw createError({ statusCode: 403, message: 'Missing tenant scope: ARTICLE_WRITE_OTHERS' })
  return { ...access, article }
}
