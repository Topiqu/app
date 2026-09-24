import { KNOWLEDGE_SOURCE_VIEW, requireKnowledgeAccess } from '~~/server/utils/knowledge/sources'

const PREVIEW_CHUNKS = 50

export default defineEventHandler(async (event) => {
  const { clientSiteId, db } = await requireKnowledgeAccess(event)
  const id = getRouterParam(event, 'id')
  const source = id
    ? await db.knowledgeSource.findFirst({
        where: { id, clientSiteId, deletedAt: null },
        select: { ...KNOWLEDGE_SOURCE_VIEW, content: true, version: true },
      })
    : null
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Knowledge source not found' })

  // Chunks are policy-denied to the ORM; the source lookup above is what authorises this read.
  const chunks = await prisma.$queryRaw<{ ordinal: number; content: string }[]>`
    SELECT "ordinal", "content" FROM "KnowledgeChunk"
    WHERE "sourceId" = ${source.id} AND "clientSiteId" = ${clientSiteId} AND "version" = ${source.version}
    ORDER BY "ordinal" LIMIT ${PREVIEW_CHUNKS}`
  const { content, version: _version, ...view } = source
  // Only notes are edited as text; extracted files and pages are re-imported, not hand-edited.
  return { source: { ...view, content: source.kind === 'NOTE' ? content : null }, chunks }
})
