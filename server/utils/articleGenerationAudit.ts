import { toDatabaseJson } from './databaseJson'
import { withArticleUsageStage } from './ai/articleUsage'

export type ArticleGenerationStage =
  | 'configuration'
  | 'reservation'
  | 'session'
  | 'topic'
  | 'research'
  | 'knowledge'
  | 'writing'
  | 'review'
  | 'revision'
  | 'media'
  | 'image_generation'
  | 'image_check'
  | 'linking'
  | 'series'
  | 'persistence'
  | 'publication'
  | 'settlement'

type Metadata = Record<string, unknown>
type Step = {
  complete: (metadata?: Metadata) => Promise<void>
  fail: (error: unknown) => Promise<void>
}

export type ArticleGenerationAudit = {
  record: (action: string, metadata?: Metadata) => Promise<void>
  startStep: (stage: ArticleGenerationStage, metadata?: Metadata) => Promise<Step>
  skip: (stage: ArticleGenerationStage, reason: string) => Promise<void>
  setArticleId: (id: string) => void
  stageForError: (error: unknown) => ArticleGenerationStage | null
  readonly failedStage: ArticleGenerationStage | null
}

/** Correlates durable audit events without allowing telemetry failures to discard an article. */
export const createArticleGenerationAudit = (context: {
  attemptId: string
  mode: 'manual' | 'scheduled'
  clientSiteId: string
  userId?: string
  ip?: string
  articleId?: string
}): ArticleGenerationAudit => {
  let articleId = context.articleId
  let failedStage: ArticleGenerationStage | null = null
  const failedStages = new Map<unknown, ArticleGenerationStage>()
  const record = async (action: string, metadata: Metadata = {}) => {
    try {
      await logAction({
        action,
        userId: context.userId,
        clientSiteId: context.clientSiteId,
        ip: context.ip,
        metadata: toDatabaseJson({
          ...metadata,
          attemptId: context.attemptId,
          mode: context.mode,
          articleId: articleId ?? null,
        }) as Record<string, unknown>,
      })
    } catch (error) {
      try {
        await reportCaughtError('Article generation audit logging failed', error, {
          action,
          attemptId: context.attemptId,
          clientSiteId: context.clientSiteId,
        })
      } catch {
        // Reporting can fail too; neither logging backend owns the generation's outcome.
      }
    }
  }

  return {
    record,
    async startStep(stage, metadata = {}) {
      await record('ARTICLE_GENERATION_STEP_STARTED', { ...metadata, stage })
      const startedAt = Date.now()
      let finished = false
      const finish = async (action: string, result: Metadata) => {
        if (finished) return
        finished = true
        await record(action, { ...metadata, ...result, stage, durationMs: Math.max(0, Date.now() - startedAt) })
      }
      return {
        complete: (result = {}) => finish('ARTICLE_GENERATION_STEP_COMPLETED', result),
        async fail(error) {
          if (finished) return
          failedStage = stage
          failedStages.set(error, stage)
          await finish('ARTICLE_GENERATION_STEP_FAILED', {
            error: (error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error').slice(
              0,
              1000,
            ),
          })
        },
      }
    },
    skip: (stage, reason) => record('ARTICLE_GENERATION_STEP_SKIPPED', { stage, reason }),
    setArticleId(id) {
      articleId = id
    },
    stageForError: (error) => failedStages.get(error) ?? null,
    get failedStage() {
      return failedStage
    },
  }
}

export const auditArticleStep = async <T>(
  audit: ArticleGenerationAudit | undefined,
  stage: ArticleGenerationStage,
  run: () => Promise<T>,
  summarize?: (result: T) => Metadata,
  metadata: Metadata = {},
): Promise<T> => {
  if (!audit) return withArticleUsageStage(stage, run)
  const step = await audit.startStep(stage, metadata)
  let result: T
  try {
    result = await withArticleUsageStage(stage, run)
  } catch (error) {
    await step.fail(error)
    throw error
  }
  try {
    await step.complete(summarize?.(result))
  } catch {
    await step.complete({ summaryUnavailable: true })
  }
  return result
}
