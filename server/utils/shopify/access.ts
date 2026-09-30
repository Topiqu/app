import type { H3Event } from 'h3'

import { shopifyEligible } from './config'

export const requireShopifyAccess = async (
  event: H3Event,
  scope: 'INTEGRATION_CONTROL' | 'ARTICLE_WRITE' | 'ARTICLE_PUBLISH' = 'INTEGRATION_CONTROL',
) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  await requireTenantScope(event, scope, user.clientSiteId)
  const db = await getEnhancedPrisma(user)
  const site = await db.clientSite.findUnique({ where: { id: user.clientSiteId! }, select: { id: true, plan: true } })
  if (!site || !shopifyEligible(site.plan))
    throw createError({ statusCode: 403, message: 'Shopify requires Pro or Premium' })
  return { user, db, site }
}
