import { z } from 'zod'
import { KNOWLEDGE_CURRENCIES } from '~~/shared/utils/knowledge'
import { fetchKnowledgeFeed } from '~~/server/utils/knowledge/feed'
import {
  assertCitableUrl,
  knowledgeExtractFailure,
  knowledgeLimits,
  limitKnowledgeRequests,
  requireKnowledgeAccess,
} from '~~/server/utils/knowledge/sources'

const InputSchema = z.object({
  url: z.string().trim().url().max(2048),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine((code) => KNOWLEDGE_CURRENCIES.includes(code)),
})

/**
 * Checks a feed before it is added, so a wrong link fails in the dialog instead of later in the
 * list. Nothing is stored; `POST /api/knowledge` still validates and the sync fetches again.
 */
export default defineEventHandler(async (event) => {
  const { clientSiteId } = await requireKnowledgeAccess(event)
  await requireAiPlan(clientSiteId, 'Knowledge requires an AI plan')
  await limitKnowledgeRequests(event, clientSiteId, 'feed', 20)
  const { url, currency } = await readValidatedBody(event, InputSchema.parse)

  const limits = await knowledgeLimits(clientSiteId)
  try {
    const { products, report } = await fetchKnowledgeFeed(await assertCitableUrl(url), {
      currency,
      limit: Math.max(0, limits.maxProducts - limits.usage.products),
    })
    return {
      found: report.products + report.truncated,
      fits: report.products,
      sample: products.slice(0, 3).map((product) => product.name),
    }
  } catch (error) {
    throw await knowledgeExtractFailure(event, error, 'knowledge.feed.errors')
  }
})
