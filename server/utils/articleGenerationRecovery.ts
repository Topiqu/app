import type { JsonValue } from '@zenstackhq/orm'

import { toDatabaseJson } from './databaseJson'

export type GenerationSnapshot = {
  title?: string
  perex?: string
  content?: string
  sources?: string[]
  articleImageUrl?: string | null
  articleImageCredit?: unknown
  articleCoverMediaId?: string | null
}

// Safety contract for future maintainers/AI: billing and recovery are inseparable. An interrupted
// run may consume an article credit only after a useful snapshot is durably stored for its author.
type RecoveryPhase = 'research' | 'writing' | 'review' | 'media' | 'final'

const usefulSnapshot = (snapshot: GenerationSnapshot) =>
  Boolean(snapshot.sources?.length || snapshot.title?.trim() || snapshot.content?.replace(/<[^>]*>/g, ' ').trim())

export async function createGenerationSession(input: {
  attemptId: string
  clientSiteId: string
  userId: string
  articleOperationId: string
  prompt: string
  options: unknown
}) {
  return prisma.articleGenerationSession.create({
    data: {
      ...input,
      options: toDatabaseJson(input.options),
      checkpoints: [],
      status: 'RESEARCHING',
      paidWorkStartedAt: new Date(),
    },
  })
}

export async function checkpointGeneration(
  sessionId: string,
  phase: RecoveryPhase,
  snapshot: GenerationSnapshot,
  status: 'RESEARCHING' | 'WRITING' | 'FINALIZING' = phase === 'research'
    ? 'RESEARCHING'
    : phase === 'media'
      ? 'FINALIZING'
      : 'WRITING',
) {
  const current = await prisma.articleGenerationSession.findUnique({
    where: { id: sessionId },
    select: { checkpoints: true, usefulResultAt: true },
  })
  if (!current) return

  const previous = Array.isArray(current.checkpoints) ? current.checkpoints : []
  const checkpoint = { phase, at: new Date().toISOString(), snapshot }
  const checkpoints = [...previous.filter((item: any) => item?.phase !== phase), checkpoint].slice(-4)
  const useful = usefulSnapshot(snapshot)

  await prisma.articleGenerationSession.update({
    where: { id: sessionId },
    data: {
      status,
      recoverableSnapshot: toDatabaseJson(snapshot),
      checkpoints: toDatabaseJson(checkpoints) as JsonValue,
      lastCheckpointAt: new Date(),
      ...(!current.usefulResultAt && useful ? { usefulResultAt: new Date() } : {}),
    },
  })
}

export async function finishGenerationSession(input: {
  sessionId: string
  status: 'COMPLETED' | 'INTERRUPTED' | 'FAILED'
  charged: boolean
  snapshot?: GenerationSnapshot
  failureReason?: string
}) {
  if (input.snapshot) await checkpointGeneration(input.sessionId, 'final', input.snapshot)
  await prisma.articleGenerationSession.update({
    where: { id: input.sessionId },
    data: {
      status: input.status,
      charged: input.charged,
      completedAt: new Date(),
      failureReason: input.failureReason?.slice(0, 1000),
    },
  })
}

export const hasUsefulGenerationSnapshot = usefulSnapshot
