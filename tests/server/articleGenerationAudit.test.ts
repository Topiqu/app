import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { stubNitroImports } from '../helpers/nitroImports'

async function stubImports() {
  await stubNitroImports(import('../../server/utils/databaseJson'), 'toDatabaseJson')
}

await stubImports()

const { auditArticleStep, createArticleGenerationAudit } = await import('../../server/utils/articleGenerationAudit')

const log = vi.fn()
const report = vi.fn()
const context = {
  attemptId: 'attempt-1',
  mode: 'manual' as const,
  clientSiteId: 'tenant-1',
  userId: 'author-1',
  ip: '203.0.113.4',
}

beforeEach(() => {
  log.mockReset().mockResolvedValue({})
  report.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal('logAction', log)
  vi.stubGlobal('reportCaughtError', report)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('article generation audit', () => {
  it('correlates completed stages and measures the work without storing the generated body', async () => {
    vi.useFakeTimers()
    const audit = createArticleGenerationAudit(context)
    const article = { content: 'Private article body', tokens: 42 }
    const result = await auditArticleStep(
      audit,
      'writing',
      async () => {
        vi.advanceTimersByTime(1250)
        return article
      },
      ({ tokens }) => ({ tokens }),
    )
    expect(result).toBe(article)
    expect(log.mock.calls.map(([entry]) => entry.action)).toEqual([
      'ARTICLE_GENERATION_STEP_STARTED',
      'ARTICLE_GENERATION_STEP_COMPLETED',
    ])
    expect(log).toHaveBeenLastCalledWith({
      action: 'ARTICLE_GENERATION_STEP_COMPLETED',
      userId: 'author-1',
      clientSiteId: 'tenant-1',
      ip: '203.0.113.4',
      metadata: {
        attemptId: 'attempt-1',
        mode: 'manual',
        articleId: null,
        stage: 'writing',
        durationMs: 1250,
        tokens: 42,
      },
    })
    expect(JSON.stringify(log.mock.calls)).not.toContain(article.content)
  })

  it('records the failing stage and rethrows the original provider error', async () => {
    const audit = createArticleGenerationAudit(context)
    const failure = new Error('Provider unavailable')
    await expect(
      auditArticleStep(audit, 'research', async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(audit.failedStage).toBe('research')
    expect(log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'ARTICLE_GENERATION_STEP_FAILED',
        metadata: expect.objectContaining({ stage: 'research', error: 'Provider unavailable', attemptId: 'attempt-1' }),
      }),
    )
  })

  it('keeps a finished article even when both logging and error reporting are unavailable', async () => {
    log.mockRejectedValue(new Error('Database unavailable'))
    report.mockRejectedValue(new Error('Reporter unavailable'))
    const audit = createArticleGenerationAudit(context)
    await expect(auditArticleStep(audit, 'media', async () => 'finished')).resolves.toBe('finished')
    expect(report).toHaveBeenCalledTimes(2)
  })

  it('preserves a successful result when a telemetry summary is broken', async () => {
    const audit = createArticleGenerationAudit(context)
    await expect(
      auditArticleStep(
        audit,
        'writing',
        async () => 'finished',
        () => {
          throw new Error('Bad summary')
        },
      ),
    ).resolves.toBe('finished')
    expect(log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'ARTICLE_GENERATION_STEP_COMPLETED',
        metadata: expect.objectContaining({ summaryUnavailable: true }),
      }),
    )
  })

  it('finishes a stage once even if a later pipeline error tries to fail it', async () => {
    const audit = createArticleGenerationAudit(context)
    const step = await audit.startStep('writing')
    await step.complete()
    await step.fail(new Error('Later persistence failed'))
    await step.complete()
    expect(log).toHaveBeenCalledTimes(2)
    expect(audit.failedStage).toBeNull()
  })

  it('adds the saved article ID to subsequent events and removes undefined metadata', async () => {
    const audit = createArticleGenerationAudit(context)
    audit.setArticleId('article-1')
    await audit.record('CRON_GENERATION_COMPLETED', { attemptId: 'spoofed', articleId: 'spoofed', optional: undefined })
    expect(log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: { attemptId: 'attempt-1', mode: 'manual', articleId: 'article-1' },
      }),
    )
  })

  it('distinguishes disabled steps from failures', async () => {
    const audit = createArticleGenerationAudit(context)
    await audit.skip('knowledge', 'disabled')
    expect(log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'ARTICLE_GENERATION_STEP_SKIPPED',
        metadata: expect.objectContaining({ stage: 'knowledge', reason: 'disabled' }),
      }),
    )
    expect(audit.failedStage).toBeNull()
  })

  it('does not misattribute a later error to a handled fallback from an earlier stage', async () => {
    const audit = createArticleGenerationAudit(context)
    const reviewFailure = new Error('Review unavailable')
    const persistenceFailure = new Error('Snapshot unavailable')
    await expect(
      auditArticleStep(audit, 'review', async () => {
        throw reviewFailure
      }),
    ).rejects.toBe(reviewFailure)
    await audit.record('ARTICLE_GENERATION_FALLBACK', { stage: 'review', outcome: 'draft' })
    expect(audit.stageForError(reviewFailure)).toBe('review')
    expect(audit.stageForError(persistenceFailure)).toBeNull()
    await expect(
      auditArticleStep(audit, 'persistence', async () => {
        throw persistenceFailure
      }),
    ).rejects.toBe(persistenceFailure)
    expect(audit.stageForError(persistenceFailure)).toBe('persistence')
    expect(audit.stageForError(reviewFailure)).toBe('review')
  })
})

beforeEach(stubImports)
