import { requireKnowledgeAccess } from '~~/server/utils/knowledge/sources'

/** A hard delete: chunks cascade, and there is no stored file behind it to purge. */
export default defineEventHandler(async (event) => {
  const { user, clientSiteId, db } = await requireKnowledgeAccess(event)
  const id = getRouterParam(event, 'id')
  const source = id
    ? await db.knowledgeSource.findFirst({ where: { id, clientSiteId }, select: { id: true, kind: true, title: true } })
    : null
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Knowledge source not found' })
  await db.knowledgeSource.delete({ where: { id: source.id } })
  await logAction({
    action: 'KNOWLEDGE_SOURCE_DELETED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: { sourceId: source.id, kind: source.kind, title: source.title },
  })
  return { ok: true }
})
