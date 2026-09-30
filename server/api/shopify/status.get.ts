import { shopifyConfigured, shopifyEligible } from '../../utils/shopify/config'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event, { role: ['admin', 'superadmin'], clientSite: true })
  const db = await getEnhancedPrisma(user)
  const { membership } = await requireTenantMember(event, user.clientSiteId)
  const canManage = hasTenantScope(membership, 'INTEGRATION_CONTROL')
  const canPublish = hasTenantScope(membership, 'ARTICLE_PUBLISH') && hasTenantScope(membership, 'ARTICLE_WRITE')
  const site = await db.clientSite.findUnique({ where: { id: user.clientSiteId! }, select: { plan: true } })
  const eligible = Boolean(site && shopifyEligible(site.plan))
  if (!eligible) return { configured: shopifyConfigured(), eligible: false, canManage, canPublish, connection: null }
  const connection = await db.shopifyConnection.findUnique({
    where: { clientSiteId: user.clientSiteId! },
    select: { shop: true, shopName: true, blogId: true, blogTitle: true, author: true, status: true },
  })
  return { configured: shopifyConfigured(), eligible, canManage, canPublish, connection }
})
