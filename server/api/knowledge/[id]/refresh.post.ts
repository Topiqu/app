import {
  kickKnowledgeIndex,
  knowledgeExtractFailure,
  KNOWLEDGE_SOURCE_VIEW,
  limitKnowledgeRequests,
  refetchKnowledgeUrl,
  requireKnowledgeAccess,
} from '~~/server/utils/knowledge/sources'

/** Re-fetches a URL source (re-embedding only when its text changed) or retries a failed index. */
export default defineEventHandler(async (event) => {
  const { user, clientSiteId, db } = await requireKnowledgeAccess(event)
  await requireAiPlan(clientSiteId, 'Knowledge requires an AI plan')
  await limitKnowledgeRequests(event, clientSiteId, 'refresh', 60)
  const id = getRouterParam(event, 'id')
  const source = id
    ? await db.knowledgeSource.findFirst({
        where: { id, clientSiteId, deletedAt: null },
        select: { id: true, kind: true, sourceUrl: true, contentHash: true, status: true },
      })
    : null
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Knowledge source not found' })
  if (source.status === 'PROCESSING') throw createError({ statusCode: 409, statusMessage: 'Indexing is in progress' })

  let changed = false
  if (source.kind === 'URL' && source.sourceUrl) {
    try {
      changed = await refetchKnowledgeUrl({ ...source, sourceUrl: source.sourceUrl })
    } catch (error) {
      throw await knowledgeExtractFailure(event, error)
    }
  }
  if (!changed && source.status === 'FAILED')
    await db.knowledgeSource.update({ where: { id: source.id }, data: { status: 'PENDING', attempts: 0, error: null } })

  await logAction({
    action: 'KNOWLEDGE_SOURCE_REFRESHED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { sourceId: source.id, changed },
  })
  kickKnowledgeIndex(source.id)
  return { source: await db.knowledgeSource.findUniqueOrThrow({ where: { id: source.id }, select: KNOWLEDGE_SOURCE_VIEW }), changed }
})
