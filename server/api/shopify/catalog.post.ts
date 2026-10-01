import { z } from 'zod'
import { LANGUAGE_OPTIONS } from '~~/shared/siteSchemas'
import { KNOWLEDGE_CONSENT_VERSION } from '~~/shared/utils/knowledge'

import { requireShopifyAccess } from '../../utils/shopify/access'
import {
  hashKnowledge,
  knowledgeLimits,
  limitKnowledgeRequests,
  kickKnowledgeIndex,
} from '../../utils/knowledge/sources'

const InputSchema = z.object({ language: z.enum(LANGUAGE_OPTIONS), confirmed: z.literal(true) })

export default defineEventHandler(async (event) => {
  const { user, site, db } = await requireShopifyAccess(event)
  await requireTenantScope(event, 'TENANT_SETTINGS', site.id)
  await requireAiPlan(site.id, 'Knowledge requires an AI plan')
  await limitKnowledgeRequests(event, site.id, 'shopify-catalog', 20)
  const input = await readValidatedBody(event, InputSchema.parse)
  const connection = await db.shopifyConnection.findUnique({
    where: { clientSiteId: site.id },
    select: { id: true, shopName: true, status: true, grantedScopes: true },
  })
  if (!connection || connection.status !== 'CONNECTED' || !connection.grantedScopes.includes('read_products'))
    throw createError({ statusCode: 409, message: 'Reconnect Shopify to import products' })
  const existing = await db.knowledgeSource.findUnique({ where: { shopifyConnectionId: connection.id } })
  if (existing?.status === 'PROCESSING')
    throw createError({ statusCode: 409, message: 'Catalog synchronization is in progress' })
  if (!existing || existing.deletedAt) {
    const limits = await knowledgeLimits(site.id)
    if (limits.usage.sources >= limits.maxSources || limits.usage.products >= limits.maxProducts)
      throw createError({ statusCode: 409, message: 'Knowledge quota reached', data: { code: 'KNOWLEDGE_QUOTA' } })
  }
  const source = await db.knowledgeSource.upsert({
    where: { shopifyConnectionId: connection.id },
    create: {
      clientSiteId: site.id,
      createdById: user.id,
      shopifyConnectionId: connection.id,
      kind: 'SHOPIFY',
      title: connection.shopName.slice(0, 200),
      language: input.language,
      content: '',
      contentHash: hashKnowledge(connection.id),
    },
    update: { deletedAt: null, status: 'PENDING', attempts: 0, language: input.language, error: null },
    select: { id: true },
  })
  await logAction({
    action: 'KNOWLEDGE_SOURCE_CREATED',
    userId: user.id,
    clientSiteId: site.id,
    ip: getIp(event),
    metadata: {
      sourceId: source.id,
      kind: 'SHOPIFY',
      consent: { version: KNOWLEDGE_CONSENT_VERSION, confirmedAt: new Date().toISOString() },
    },
  })
  kickKnowledgeIndex(source.id)
  return { sourceId: source.id }
})
