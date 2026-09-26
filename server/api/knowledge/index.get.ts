import { KNOWLEDGE_LIMITS } from '~~/shared/utils/knowledge'
import { KNOWLEDGE_SOURCE_VIEW, knowledgeLimits, requireKnowledgeAccess } from '~~/server/utils/knowledge/sources'

export default defineEventHandler(async (event) => {
  const { clientSiteId, db } = await requireKnowledgeAccess(event)
  const [sources, limits] = await Promise.all([
    db.knowledgeSource.findMany({
      where: { clientSiteId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: KNOWLEDGE_SOURCE_VIEW,
    }),
    knowledgeLimits(clientSiteId),
  ])
  return { sources, limits: { ...limits, maxFileBytes: KNOWLEDGE_LIMITS.maxFileBytes } }
})
