import { z } from 'zod'
import { retrieveKnowledge } from '~~/server/utils/knowledge/retrieve'
import { limitKnowledgeRequests, requireKnowledgeAccess } from '~~/server/utils/knowledge/sources'

/** The playground: shows what a writer would receive for a topic, without counting as usage. */
export default defineEventHandler(async (event) => {
  const { user, clientSiteId } = await requireKnowledgeAccess(event)
  await requireAiPlan(clientSiteId, 'Knowledge requires an AI plan')
  const { topic } = await readValidatedBody(event, z.object({ topic: z.string().trim().min(3).max(500) }).parse)
  await limitKnowledgeRequests(event, clientSiteId, 'test', 30)

  const result = await retrieveKnowledge(clientSiteId, topic, { track: false })
  await logAction({
    action: 'KNOWLEDGE_TEST_QUERY',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { tokens: result.tokens, selected: result.used.length },
  })
  return { brief: result.brief, shortlist: result.shortlist ?? [], used: result.used.length }
})
