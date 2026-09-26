import type { H3Event } from 'h3'

import { createHash } from 'node:crypto'
import { knowledgeQuota } from '~~/shared/utils/knowledge'

import { indexKnowledgeSource } from './indexing'
import { assertPublicHttpsUrl } from '../images/publicFetch'
import { extractKnowledgeUrl, KnowledgeExtractError } from './extract'

/** What the list and detail UI receive; `content` stays server-side. */
export const KNOWLEDGE_SOURCE_VIEW = {
  id: true,
  kind: true,
  title: true,
  status: true,
  useInArticles: true,
  publicUrl: true,
  sourceUrl: true,
  originalFilename: true,
  mimeType: true,
  sizeBytes: true,
  chunkCount: true,
  error: true,
  indexedAt: true,
  validAsOf: true,
  fetchedAt: true,
  usageCount: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

/** Knowledge steers every generated article, so managing it is a tenant-settings power. */
export const requireKnowledgeAccess = async (event: H3Event) => {
  const { user } = await requireTenantScope(event, 'TENANT_SETTINGS')
  return { user, clientSiteId: user.clientSiteId!, db: await getEnhancedPrisma(user) }
}

/**
 * Every endpoint that fetches a URL or pays for embeddings/model calls. Per tenant caps cost,
 * per IP stops one client from exhausting a shared office's budget or probing hosts.
 */
export const limitKnowledgeRequests = async (event: H3Event, clientSiteId: string, action: string, limit: number) => {
  const [tenant, ip] = await Promise.all([
    consumeRateLimit(`knowledge:${action}:site:${clientSiteId}`, limit, 60 * 60),
    consumeRateLimit(`knowledge:${action}:ip:${getIp(event)}`, limit, 60 * 60),
  ])
  if (tenant && ip) return
  const { translate: t } = await useServerI18n(event)
  throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests') || 'Too many requests' })
}

export const knowledgeUsage = async (clientSiteId: string) => {
  const [row] = await prisma.$queryRaw<{ sources: number; characters: number }[]>`
    SELECT count(*)::int AS sources, COALESCE(sum(length("content")), 0)::int AS characters
    FROM "KnowledgeSource" WHERE "clientSiteId" = ${clientSiteId} AND "deletedAt" IS NULL`
  return row ?? { sources: 0, characters: 0 }
}

export const knowledgeLimits = async (clientSiteId: string) => {
  const [site, usage] = await Promise.all([
    prisma.clientSite.findUnique({ where: { id: clientSiteId }, select: { plan: true } }),
    knowledgeUsage(clientSiteId),
  ])
  return { ...knowledgeQuota(site?.plan), usage }
}

export const hashKnowledge = (content: string) => createHash('sha256').update(content).digest('hex')

export const assertCitableUrl = async (url: string) => {
  try {
    return (await assertPublicHttpsUrl(url)).toString()
  } catch {
    throw createError({ statusCode: 422, statusMessage: 'Public source URL must be a public https address' })
  }
}

export const knowledgeExtractFailure = async (event: H3Event, error: unknown) => {
  if (!(error instanceof KnowledgeExtractError)) return error
  const { translate: t } = await useServerI18n(event)
  return createError({ statusCode: 422, message: t(`knowledge.errors.${error.code}`) || error.message })
}

/** Starts indexing right away instead of waiting up to five minutes for the cron; the cron stays the safety net. */
export const kickKnowledgeIndex = (id: string) => {
  indexKnowledgeSource(id).catch((error) => reportCaughtError('Knowledge index kick failed', error, { sourceId: id }))
}

/**
 * Re-fetches a URL source. Unchanged text only moves `fetchedAt`; changed text becomes a new
 * version, and its page date replaces `validAsOf` because the old date described the old text.
 * Extraction errors propagate so the route can translate them and the cron can record them.
 */
export const refetchKnowledgeUrl = async (source: { id: string; sourceUrl: string; contentHash: string }) => {
  const extracted = await extractKnowledgeUrl(source.sourceUrl)
  const contentHash = hashKnowledge(extracted.content)
  const changed = contentHash !== source.contentHash
  await prisma.knowledgeSource.update({
    where: { id: source.id },
    data: {
      fetchedAt: new Date(),
      error: null,
      ...(changed
        ? {
            content: extracted.content,
            contentHash,
            validAsOf: extracted.validAsOf ?? null,
            version: { increment: 1 },
            status: 'PENDING' as const,
            attempts: 0,
          }
        : {}),
    },
  })
  return changed
}
