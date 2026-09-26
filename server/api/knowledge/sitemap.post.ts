import { z } from 'zod'
import { KNOWLEDGE_LIMITS } from '~~/shared/utils/knowledge'
import { discoverSitemapPages } from '~~/server/utils/knowledge/sitemap'
import {
  assertCitableUrl,
  knowledgeExtractFailure,
  knowledgeLimits,
  limitKnowledgeRequests,
  requireKnowledgeAccess,
} from '~~/server/utils/knowledge/sources'

const InputSchema = z.object({ url: z.string().trim().url().max(2048) })

/**
 * Discovery only: returns the pages to import, which the client then adds one by one through
 * `POST /api/knowledge`, so extraction, dedupe, quotas and rate limits stay in one place.
 */
export default defineEventHandler(async (event) => {
  const { clientSiteId, db } = await requireKnowledgeAccess(event)
  await requireAiPlan(clientSiteId, 'Knowledge requires an AI plan')
  await limitKnowledgeRequests(event, clientSiteId, 'sitemap', 10)
  const { url } = await readValidatedBody(event, InputSchema.parse)

  let pages: string[]
  try {
    pages = await discoverSitemapPages(await assertCitableUrl(url))
  } catch (error) {
    throw await knowledgeExtractFailure(event, error)
  }

  const [known, limits] = await Promise.all([
    db.knowledgeSource.findMany({
      where: { clientSiteId, deletedAt: null, sourceUrl: { in: pages } },
      select: { sourceUrl: true },
    }),
    knowledgeLimits(clientSiteId),
  ])
  const existing = new Set(known.map((source) => source.sourceUrl))
  const fresh = pages.filter((page) => !existing.has(page))
  const room = Math.max(0, limits.maxSources - limits.usage.sources)
  return {
    urls: fresh.slice(0, Math.min(room, KNOWLEDGE_LIMITS.maxSitemapPages)),
    found: pages.length,
    existing: existing.size,
    quotaLeft: room,
  }
})
