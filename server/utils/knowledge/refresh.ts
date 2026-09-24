import { KNOWLEDGE_REFRESH_DAYS } from '~~/shared/utils/knowledge'

import { refetchKnowledgeUrl } from './sources'
import { aiEmbeddingModelId } from '../ai/modelRegistry'

const BATCH_SIZE = 50

/**
 * Re-fetches URL sources older than a week and requeues sources embedded by a retired model.
 * A failed fetch keeps the last good index and only records the error, so a flaky site never
 * wipes knowledge the articles still rely on.
 */
export const refreshKnowledgeSources = async (now = new Date()) => {
  const before = new Date(now.getTime() - KNOWLEDGE_REFRESH_DAYS * 86_400_000)
  const due = await prisma.knowledgeSource.findMany({
    where: {
      kind: 'URL',
      deletedAt: null,
      status: { in: ['INDEXED', 'FAILED'] },
      sourceUrl: { not: null },
      OR: [{ fetchedAt: null }, { fetchedAt: { lt: before } }],
      clientSite: activeFeatureFilter('AI'),
    },
    orderBy: { fetchedAt: { sort: 'asc', nulls: 'first' } },
    take: BATCH_SIZE,
    select: { id: true, sourceUrl: true, contentHash: true, clientSiteId: true },
  })

  let changed = 0
  let failed = 0
  for (const source of due) {
    try {
      if (await refetchKnowledgeUrl({ ...source, sourceUrl: source.sourceUrl! })) changed += 1
    } catch (error) {
      failed += 1
      await prisma.knowledgeSource.update({
        where: { id: source.id },
        data: { fetchedAt: now, error: (error instanceof Error ? error.message : 'Refresh failed').slice(0, 500) },
      })
    }
  }

  const reembed = await prisma.knowledgeSource.updateMany({
    where: { status: 'INDEXED', deletedAt: null, embeddingModel: { not: aiEmbeddingModelId('knowledge') } },
    data: { status: 'PENDING', attempts: 0 },
  })
  if (changed || failed)
    await logAction({ action: 'KNOWLEDGE_REFRESH_RUN', metadata: { checked: due.length, changed, failed } })
  return { checked: due.length, changed, failed, reembed: reembed.count }
}
