import type { ShopifyCollectionInsight } from '~~/shared/types/shopify'

import { requireShopifyAccess } from '../../utils/shopify/access'

export default defineEventHandler(async (event) => {
  const { db, site } = await requireShopifyAccess(event)
  const { membership } = await requireTenantMember(event, site.id)
  const connection = await db.shopifyConnection.findUnique({
    where: { clientSiteId: site.id },
    select: { grantedScopes: true },
  })
  const source = await db.knowledgeSource.findFirst({
    where: { clientSiteId: site.id, kind: 'SHOPIFY', deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      language: true,
      chunkCount: true,
      fetchedAt: true,
      error: true,
      syncReport: true,
    },
  })
  const report = source?.syncReport as { collections?: ShopifyCollectionInsight[]; truncated?: number } | null
  return {
    source,
    collections: report?.collections ?? [],
    truncated: report?.truncated ?? 0,
    canIngest: hasTenantScope(membership, 'TENANT_SETTINGS'),
    canWrite: hasTenantScope(membership, 'ARTICLE_WRITE'),
    inventoryUpdates: connection?.grantedScopes.includes('read_inventory') ?? false,
  }
})
