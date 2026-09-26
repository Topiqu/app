import { z } from 'zod'
import { normalizeKnowledgeText } from '~~/server/utils/knowledge/extract'
import { KNOWLEDGE_CONSENT_VERSION, KNOWLEDGE_LIMITS } from '~~/shared/utils/knowledge'
import {
  assertCitableUrl,
  hashKnowledge,
  kickKnowledgeIndex,
  KNOWLEDGE_SOURCE_VIEW,
  requireKnowledgeAccess,
} from '~~/server/utils/knowledge/sources'

const InputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  useInArticles: z.boolean().optional(),
  publicUrl: z.string().trim().url().max(2048).nullable().optional(),
  text: z.string().trim().min(1).max(KNOWLEDGE_LIMITS.maxNoteCharacters).optional(),
  validAsOf: z.iso.date().nullable().optional(),
  confirmed: z.literal(true).optional(),
})

export default defineEventHandler(async (event) => {
  const { user, clientSiteId, db } = await requireKnowledgeAccess(event)
  const id = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, InputSchema.parse)
  const current = id
    ? await db.knowledgeSource.findFirst({
        where: { id, clientSiteId, deletedAt: null },
        select: { id: true, kind: true, contentHash: true, publicUrl: true },
      })
    : null
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Knowledge source not found' })
  if (body.text !== undefined && current.kind !== 'NOTE')
    throw createError({ statusCode: 400, statusMessage: 'Only notes can be edited in place' })

  const content = body.text === undefined ? undefined : normalizeKnowledgeText(body.text)
  const contentChanged = content !== undefined && hashKnowledge(content) !== current.contentHash
  // New text is new content: it needs the same confirmation as adding a source.
  if (contentChanged && !body.confirmed)
    throw createError({ statusCode: 400, statusMessage: 'Confirmation required', data: { code: 'KNOWLEDGE_CONSENT' } })
  const source = await db.knowledgeSource.update({
    where: { id: current.id },
    data: {
      title: body.title,
      useInArticles: body.useInArticles,
      publicUrl: body.publicUrl ? await assertCitableUrl(body.publicUrl) : body.publicUrl,
      validAsOf: body.validAsOf === undefined ? undefined : body.validAsOf ? new Date(body.validAsOf) : null,
      ...(contentChanged
        ? {
            content,
            contentHash: hashKnowledge(content!),
            version: { increment: 1 },
            status: 'PENDING' as const,
            attempts: 0,
            error: null,
          }
        : {}),
    },
    select: KNOWLEDGE_SOURCE_VIEW,
  })
  await logAction({
    action: 'KNOWLEDGE_SOURCE_UPDATED',
    userId: user.id,
    clientSiteId,
    ip: getIp(event),
    metadata: {
      sourceId: current.id,
      changedFields: Object.keys(body),
      contentChanged,
      ...(contentChanged ? { consent: { version: KNOWLEDGE_CONSENT_VERSION, confirmedAt: new Date().toISOString() } } : {}),
      previousPublicUrl: current.publicUrl,
      publicUrl: source.publicUrl,
    },
  })
  if (contentChanged) kickKnowledgeIndex(current.id)
  return { source }
})
