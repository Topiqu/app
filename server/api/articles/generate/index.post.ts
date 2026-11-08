import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { aiAllowanceErrorCode, aiAllowanceMessageKey } from '~~/shared/utils/aiAllowanceError'

import { articleWriterId } from '../../../utils/ai/modelRegistry'

/** The writer thinks until its first token; the writing and idle clocks start there. */
const WRITER_LIMITS = { thinkingMs: 240_000, writingMs: 300_000, idleMs: 45_000 } as const

const WRITER_TIMEOUT_MESSAGES = {
  writer_thinking: 'writerThinkingError',
  writer_idle: 'writerIdleError',
  writer_deadline: 'writerDeadlineError',
} as const

export default defineEventHandler(async (event) => {
  const { translate: t, locale } = await useServerI18n(event)
  const user = await getSessionUser(event)

  if (!user || !user.clientSiteId) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  await requireTenantScope(event, 'ARTICLE_WRITE', user.clientSiteId)

  await ensureMinAccountAge(event, user.id)

  const { prompt, options, articleId } = await readValidatedBody(
    event,
    z.object({
      prompt: z.string().nonempty(t('common.errors.missing')!),
      articleId: z.string().uuid().optional(),
      options: z
        .object({
          language: z.enum(LANGUAGE_OPTIONS).optional(),
          format: z.enum(ARTICLE_GENERATION_FORMATS),
          allowGeneratedImages: z.boolean().default(true),
          useKnowledge: z.boolean().default(true),
          modules: z.array(z.enum(ARTICLE_GENERATION_MODULES)).max(ARTICLE_GENERATION_MODULES.length),
          research: z.object({
            enabled: z.boolean(),
            depth: z.enum(RESEARCH_DEPTHS),
            fallbackWithoutResearch: z.boolean(),
          }),
        })
        .optional(),
    }).parse,
  )

  const clientSiteId = user.clientSiteId
  if (articleId) {
    const sourceArticle = await prisma.article.findFirst({
      where: { id: articleId, clientSiteId },
      select: { id: true },
    })
    if (!sourceArticle) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  }
  const attemptId = randomUUID()
  const audit = createArticleGenerationAudit({
    attemptId,
    mode: 'manual',
    userId: user.id,
    clientSiteId,
    articleId,
    ip: getIp(event),
  })
  const auditAttempt = audit.record

  await auditAttempt('MANUAL_GENERATION_STARTED', {
    promptLength: prompt.length,
    format: options?.format ?? null,
    language: options?.language ?? null,
    modules: options?.modules ?? [],
    researchDepth: options?.research.enabled ? options.research.depth : null,
    allowGeneratedImages: options?.allowGeneratedImages !== false,
    useKnowledge: options?.useKnowledge !== false,
  })

  const client = await prisma.clientSite
    .findUnique({
      where: { id: clientSiteId },
      select: { plan: true, humanHourlyRateUsd: true, humanWordsPerHour: true, articleQuality: true },
    })
    .catch(async (error) => {
      await auditAttempt('MANUAL_GENERATION_FAILED', { stage: 'preflight', reason: 'client_lookup_failed' })
      throw error
    })

  if (!client) {
    await auditAttempt('MANUAL_GENERATION_FAILED', { stage: 'preflight', reason: 'client_not_found' })
    throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })
  }

  // Read off the row already fetched rather than `requireAiPlan`, which would cost a second query.
  // Without this the only brake was the token balance, so an expired trial kept generating.
  if (!hasAiPlan(client.plan)) {
    await auditAttempt('MANUAL_GENERATION_REJECTED', { stage: 'preflight', reason: 'plan' })
    throw createError({ statusCode: 403, message: t('common.errors.featureNotInPlan')! })
  }

  const abortController = new AbortController()
  let textDone = false
  let generation: Awaited<ReturnType<typeof streamArticle>> | undefined
  let recoverySession: Awaited<ReturnType<typeof createGenerationSession>> | undefined
  let recoverySnapshot: GenerationSnapshot = {}
  let lastRecoveryCheckpointAt = 0
  let writerWaitTimer: ReturnType<typeof setTimeout> | undefined
  let timedOutStage: 'writer_thinking' | 'writer_idle' | 'writer_deadline' | null = null
  // A timeout stops only the writer, so the text it already wrote can still be reviewed and finished.
  const writerAbort = new AbortController()
  let writingAuditStep: Awaited<ReturnType<typeof audit.startStep>> | undefined

  const encoder = new TextEncoder()
  let clientAlive = true
  const send = (controller: ReadableStreamDefaultController, payload: unknown) => {
    if (!clientAlive) return
    try {
      controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
    } catch {
      clientAlive = false
    }
  }

  // Cost swings by an order of magnitude with these, and again with the model behind them. Both go
  // into the operation so spend can be segmented per model — numbers measured against one model say
  // nothing after a provider switch.
  const articleQuality = articleQualityOf(client.articleQuality)
  const creditsRequired = articleCreditCost(articleQuality)
  const runConfig = {
    articleQuality,
    creditsRequired,
    creditPolicyVersion: ARTICLE_CREDIT_POLICY_VERSION,
    mode: 'manual',
    articleId: articleId ?? null,
    format: options?.format ?? null,
    modules: options?.modules ?? [],
    researchDepth: options?.research.enabled ? options.research.depth : null,
    allowGeneratedImages: options?.allowGeneratedImages !== false,
    useKnowledge: options?.useKnowledge !== false,
    models: { research: aiModelId('articleResearch'), writer: articleWriterId(articleQuality) },
    writerEffort: ARTICLE_QUALITY_EFFORT[articleQuality],
  }

  const generationOptions = options ?? defaultArticleGenerationOptions()
  let articleReservation: Awaited<ReturnType<typeof reserveArticleCredit>>
  try {
    articleReservation = await auditArticleStep(
      audit,
      'reservation',
      () => reserveArticleCredit(clientSiteId, 'MANUAL_ARTICLE', attemptId, runConfig, creditsRequired),
      (operation) => ({ articleOperationId: operation.id, creditsReserved: operation.reserved }),
    )
  } catch (error) {
    await auditAttempt('MANUAL_GENERATION_REJECTED', {
      stage: 'reservation',
      reason: 'article_credit_reservation_failed',
    })
    throw error
  }
  try {
    recoverySession = await auditArticleStep(
      audit,
      'session',
      () =>
        createGenerationSession({
          attemptId,
          clientSiteId,
          userId: user.id,
          articleOperationId: articleReservation.id,
          prompt,
          options: { ...generationOptions, sourceArticleId: articleId ?? null },
        }),
      (session) => ({ sessionId: session.id }),
    )
  } catch (error) {
    await auditAttempt('MANUAL_GENERATION_FAILED', { stage: 'session', reason: 'session_creation_failed' })
    await settleArticleCredit(articleReservation, false, { ...runConfig, stage: 'session' })
    throw error
  }
  const usageContext = {
    attemptId,
    clientSiteId,
    operationId: articleReservation.id,
    articleQuality,
    mode: 'manual' as const,
    userId: user.id,
  }
  let resolveWork!: () => void
  const workFinished = new Promise<void>((resolve) => {
    resolveWork = resolve
  })
  event.waitUntil(workFinished)
  const stream = new ReadableStream({
    start: bindArticleUsage(usageContext, async (controller: ReadableStreamDefaultController) => {
      try {
        // Bun closes an HTTP connection after 10 seconds without bytes by default. Research and the
        // writer's time-to-first-token can both exceed that, so keep the response active below both
        // Bun's idle timeout and Cloudflare's proxy timeout while useful work is still running.
        const heartbeat = setInterval(() => send(controller, { type: 'heartbeat' }), 5_000)
        let checkingStop = false
        const stopMonitor = setInterval(async () => {
          if (checkingStop || abortController.signal.aborted) return
          checkingStop = true
          try {
            const session = await prisma.articleGenerationSession.findUnique({
              where: { id: recoverySession!.id },
              select: { failureReason: true },
            })
            if (session?.failureReason === 'USER_STOP_REQUESTED') abortController.abort()
          } catch (error) {
            await reportCaughtError('Generation stop check failed', error, {
              clientSiteId,
              sessionId: recoverySession!.id,
            })
          } finally {
            checkingStop = false
          }
        }, 2_000)

        try {
          send(controller, { type: 'reservation', articles: articleReservation.reserved })
          send(controller, { type: 'session', id: recoverySession!.id })
          send(controller, {
            type: 'phase',
            phase: options?.research.enabled === false ? 'writing' : 'research',
            attemptId,
          })
          await auditAttempt(
            options?.research.enabled === false
              ? 'MANUAL_GENERATION_RESEARCH_SKIPPED'
              : 'MANUAL_GENERATION_RESEARCH_STARTED',
            options ? { depth: options.research.depth } : {},
          )

          // Research used to run before the Response existed. A slow web-search call therefore left
          // the origin completely silent and Bun could kill the request before streaming began.
          generation = await streamArticle(clientSiteId, prompt, {
            articleQuality,
            abortSignal: abortController.signal,
            writerSignal: AbortSignal.any([abortController.signal, writerAbort.signal]),
            research: options?.research.enabled === false ? false : undefined,
            researchDepth: options?.research.depth,
            fallbackWithoutResearch: options?.research.fallbackWithoutResearch,
            format: options?.format,
            language: options?.language,
            noteLanguage: locale,
            modules: options?.modules,
            allowGeneratedImages: options?.allowGeneratedImages !== false,
            useKnowledge: options?.useKnowledge !== false,
            articleId,
            audit,
          })
          const { result, finalize, researchTokens, research, researchSources, knowledge } = generation
          recoverySnapshot.sources = researchSources
          await checkpointGeneration(recoverySession!.id, 'research', recoverySnapshot)
          send(controller, { type: 'research', ...research, sources: researchSources })
          send(controller, { type: 'phase', phase: 'writing' })
          await auditAttempt('MANUAL_GENERATION_WRITER_STARTED', { researchTokens, research, knowledge })
          writingAuditStep = await audit.startStep('writing')

          const writerStartedAt = Date.now()
          let textStartedAt: number | null = null
          let lastWriterDataAt = writerStartedAt
          let lastActivitySentAt = 0
          let writingStage: 'starting' | 'title' | 'intro' | 'body' = 'starting'
          let lastPartial: Record<string, unknown> = {}
          let salvaged: ReturnType<typeof salvageBody> = null
          let cutStage: typeof timedOutStage = null
          const writerIterator = articleWriterStream(result)[Symbol.asyncIterator]()
          try {
            for (;;) {
              const now = Date.now()
              // Before the first token only the thinking budget runs: a reasoning model is silent until then.
              const thinking = textStartedAt === null
              const idleRemaining = thinking ? Infinity : WRITER_LIMITS.idleMs - (now - lastWriterDataAt)
              const deadlineRemaining = thinking
                ? WRITER_LIMITS.thinkingMs - (now - writerStartedAt)
                : WRITER_LIMITS.writingMs - (now - (textStartedAt ?? now))
              const timeoutStage = thinking
                ? 'writer_thinking'
                : idleRemaining <= deadlineRemaining
                  ? 'writer_idle'
                  : 'writer_deadline'
              const timeoutMs = Math.max(0, Math.min(idleRemaining, deadlineRemaining))

              // Do not rely on AbortSignal to unblock a provider iterator. The race rejects our own
              // request on time even if the SDK/provider ignores abort and leaves `next()` pending.
              const next = await Promise.race([
                writerIterator.next(),
                new Promise<never>((_, reject) => {
                  writerWaitTimer = setTimeout(() => {
                    timedOutStage = timeoutStage
                    writerAbort.abort()
                    reject(new Error(timeoutStage))
                  }, timeoutMs)
                }),
              ]).finally(() => {
                if (writerWaitTimer) clearTimeout(writerWaitTimer)
                writerWaitTimer = undefined
              })

              if (next.done) break
              const part = next.value
              if (part.type === 'error') throw part.error

              lastWriterDataAt = Date.now()
              if (part.type === 'partial') {
                const partial = part.output
                textStartedAt ??= Date.now()
                lastPartial = partial
                const sources = partial.sources?.filter((source): source is string => typeof source === 'string')
                recoverySnapshot = {
                  ...recoverySnapshot,
                  ...(partial.title !== undefined ? { title: partial.title } : {}),
                  ...(partial.perex !== undefined ? { perex: partial.perex } : {}),
                  ...(partial.content !== undefined ? { content: partial.content } : {}),
                  ...(sources ? { sources } : {}),
                }
                writingStage = partial.content
                  ? 'body'
                  : partial.perex
                    ? 'intro'
                    : partial.title
                      ? 'title'
                      : writingStage
                send(controller, { type: 'partial', object: partial, writingStage })
                if (Date.now() - lastRecoveryCheckpointAt >= 10_000) {
                  await checkpointGeneration(recoverySession!.id, 'writing', recoverySnapshot)
                  lastRecoveryCheckpointAt = Date.now()
                }
              }

              // Structured output can produce real JSON deltas before enough of a field exists for a
              // partial object. Forward a throttled activity signal so the UI distinguishes active
              // generation from a stalled provider without exposing raw JSON or model reasoning.
              const activityAt = Date.now()
              if (activityAt - lastActivitySentAt >= 1_000) {
                send(controller, { type: 'activity', phase: 'writing', writingStage })
                lastActivitySentAt = activityAt
              }
            }
          } catch (error) {
            // A writer that ran out of time mid-article still leaves finished sections worth completing.
            salvaged = timedOutStage && timedOutStage !== 'writer_thinking' ? salvageBody(lastPartial) : null
            if (!salvaged) throw error
            cutStage = timedOutStage
            timedOutStage = null
          } finally {
            void writerIterator.return(undefined).catch(() => {})
          }
          textDone = true

          send(controller, { type: 'activity', phase: 'writing', writingStage: salvaged ? 'finishing' : 'review' })
          const draft = salvaged ? await generation.completeDraft(salvaged) : await result.output
          await writingAuditStep.complete({ contentLength: draft.content.length, ...(cutStage && { cut: cutStage }) })
          if (cutStage) {
            await auditAttempt('ARTICLE_GENERATION_FALLBACK', {
              stage: 'writing',
              reason: cutStage,
              outcome: 'cut_draft',
            })
            send(controller, { type: 'activity', phase: 'writing', writingStage: 'review' })
          }
          const object = await generation.review(draft, (stage) => send(controller, { type: 'review-progress', stage }))
          recoverySnapshot = { ...recoverySnapshot, ...object }
          await checkpointGeneration(recoverySession!.id, 'review', recoverySnapshot)
          send(controller, { type: 'review', review: generation.editorialReview })
          send(controller, { type: 'partial', object, writingStage: 'review' })
          // A writer aborted mid-stream may never settle its usage: its tokens go unrecorded rather than the run hang.
          const usage = salvaged
            ? await Promise.race([
                Promise.resolve(result.usage).catch(() => null),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_000)),
              ])
            : await result.usage

          send(controller, { type: 'phase', phase: 'images' })

          // Finalization is the only step that fills `[[IMAGEn]]`/`[[POLLn]]`, so its failure used to
          // reach the author as an article full of raw markers. It is best-effort now: the text is
          // written and already billable, and one dead image call must not cost the whole draft.
          const finalized = await finalize(object, {
            abortSignal: abortController.signal,
            onImage: (image) => send(controller, { type: 'image', ...image }),
            onMedia: (media) => send(controller, { type: 'media', ...media }),
          }).catch(async (error) => {
            await auditAttempt('ARTICLE_GENERATION_FALLBACK', {
              stage: 'media',
              reason: 'finalization_failed',
              outcome: 'text_only',
            })
            await reportCaughtError('Article finalization failed', error, { clientSiteId })
            send(controller, { type: 'media', stage: 'failed', completed: 0, total: 0, found: 0 })
            return {
              ...object,
              content: stripContentSlots(dropAuthoredImages(object.content)),
              articleImageUrl: '',
              articleImageCredit: null,
            }
          })
          const metrics = calculateArticleMetrics(
            finalized.content,
            client.humanHourlyRateUsd,
            client.humanWordsPerHour,
          )

          const apiTokens =
            (usage?.totalTokens || 0) +
            researchTokens +
            generation.editorialTokens +
            generation.linkTokens +
            generation.completionTokens
          recoverySnapshot = { ...recoverySnapshot, ...finalized, format: generationOptions.format, metrics }
          await auditArticleStep(audit, 'persistence', () =>
            checkpointGeneration(recoverySession!.id, 'final', recoverySnapshot),
          )
          const articleWallet = await auditArticleStep(
            audit,
            'settlement',
            () =>
              // A run cut by our time limit is not charged, as a timeout never was.
              settleArticleCredit(articleReservation, !cutStage, {
                ...runConfig,
                title: finalized.title,
                apiTokens,
                ...(cutStage && { cut: cutStage }),
              }),
            (wallet) => ({
              articlesCharged: cutStage ? 0 : articleReservation.reserved,
              articlesRemaining: wallet.available,
            }),
          )
          await auditArticleStep(
            audit,
            'persistence',
            () =>
              finishGenerationSession({
                sessionId: recoverySession!.id,
                status: 'COMPLETED',
                charged: !cutStage,
              }),
            undefined,
            { operation: 'finish_session' },
          )
          await recordAiUsage(
            clientSiteId,
            apiTokens,
            'MANUAL_GENERATION_COMPLETED',
            {
              attemptId,
              title: finalized.title,
              usage,
              researchTokens,
              editorialTokens: generation.editorialTokens,
              linkTokens: generation.linkTokens,
              completionTokens: generation.completionTokens,
              cut: cutStage,
              editorialReview: generation.editorialReview,
              metrics,
              aiInvolvement: 'ASSIST',
              createdAt: new Date(),
              ...runConfig,
            },
            event,
            user.id,
          )
          send(controller, {
            type: 'final',
            article: { ...finalized, metrics, aiInvolvement: 'ASSIST' },
            missingModules: missingArticleModules(finalized, options?.modules ?? []),
            ...(cutStage && { cut: true }),
          })
          send(controller, {
            type: 'billing',
            articlesCharged: cutStage ? 0 : articleReservation.reserved,
            articlesRemaining: articleWallet.available,
          })
        } catch (error: any) {
          await writingAuditStep?.fail(error)
          if (abortController.signal.aborted && !timedOutStage) {
            // Stopped mid-generation: log the partial usage we actually spent.
            // Research is included because it completes before the first token streams, so Stop
            // never gets it back.
            const usage = await Promise.resolve(generation?.result.usage).catch(() => null)
            const hasProviderUsage =
              (usage?.totalTokens ?? 0) + (generation?.researchTokens ?? 0) + (generation?.editorialTokens ?? 0) > 0
            const chargeInterrupted = hasProviderUsage && hasUsefulGenerationSnapshot(recoverySnapshot)
            if (hasProviderUsage) {
              await recordAiUsage(
                clientSiteId,
                (usage?.totalTokens ?? 0) + (generation?.researchTokens ?? 0) + (generation?.editorialTokens ?? 0),
                'MANUAL_GENERATION_ABORTED',
                {
                  attemptId,
                  usage,
                  researchTokens: generation?.researchTokens ?? 0,
                  stage: textDone ? 'finalization' : 'writing',
                  ...runConfig,
                },
                event,
                user.id,
              )
            } else {
              await auditAttempt('MANUAL_GENERATION_ABORTED', {
                stage: textDone ? 'finalization' : 'writing',
                apiTokens: 0,
              })
            }
            // Billing and recovery are one invariant: interrupted provider work is charged only
            // when the same request has already persisted something the author can restore.
            await checkpointGeneration(recoverySession!.id, 'final', recoverySnapshot)
            await settleArticleCredit(articleReservation, chargeInterrupted, {
              ...runConfig,
              stage: textDone ? 'finalization' : 'writing',
              interrupted: true,
              recoverable: chargeInterrupted,
            })
            await finishGenerationSession({
              sessionId: recoverySession!.id,
              status: 'INTERRUPTED',
              charged: chargeInterrupted,
              failureReason: 'Generation was interrupted by the client connection.',
            })
          } else {
            const failedStage =
              timedOutStage ??
              audit.stageForError(error) ??
              (generation ? (textDone ? 'finalization' : 'writing') : 'research')
            // The response is already a 200 with a half-written body, so this can never reach Nitro's
            // `error` hook and Sentry never sees a caught throw — without this the author got a
            // generic toast and production had no record at all.
            await auditAttempt('MANUAL_GENERATION_FAILED', {
              stage: failedStage,
              error: timedOutStage
                ? {
                    writer_thinking: 'Writer produced no text within its thinking budget',
                    writer_idle: 'Writer produced no data within its idle limit',
                    writer_deadline: 'Writer exceeded its writing budget',
                  }[timedOutStage]
                : error?.message || String(error),
            })
            await reportCaughtError('Article generation stream failed', error, {
              attemptId,
              clientSiteId,
              timedOutStage,
            })
            send(controller, {
              type: 'error',
              message:
                aiAllowanceErrorCode(error) === 'AI_ALLOWANCE_EXHAUSTED'
                  ? t(aiAllowanceMessageKey(error))
                  : timedOutStage
                    ? t(`articles.editor.ai.${WRITER_TIMEOUT_MESSAGES[timedOutStage]}`, {
                        minutes: Math.round(
                          (timedOutStage === 'writer_thinking' ? WRITER_LIMITS.thinkingMs : WRITER_LIMITS.writingMs) /
                            60_000,
                        ),
                      })
                    : t('articles.editor.aiContentFailed'),
              stage: failedStage,
              // A failed run always releases its held article below.
              creditReturned: true,
            })
            await finishGenerationSession({
              sessionId: recoverySession!.id,
              status: 'FAILED',
              charged: false,
              snapshot: recoverySnapshot,
              failureReason: error?.message || String(error),
            })
          }
          if (!abortController.signal.aborted || timedOutStage)
            await settleArticleCredit(articleReservation, false, {
              ...runConfig,
              stage: timedOutStage ?? (generation ? (textDone ? 'finalization' : 'writing') : 'research'),
            })
        } finally {
          clearInterval(heartbeat)
          clearInterval(stopMonitor)
          if (writerWaitTimer) clearTimeout(writerWaitTimer)
          try {
            controller.close()
          } catch {
            // already closed by the client
          }
        }
      } catch (error: any) {
        await auditAttempt('MANUAL_GENERATION_FAILED', { stage: 'stream', error: error.message })
        settleArticleCredit(articleReservation, false, { ...runConfig, stage: 'stream' }).catch(() => undefined)
        send(controller, { type: 'error', message: t('articles.editor.aiContentFailed') })
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      } finally {
        resolveWork()
      }
    }),
    async cancel(reason) {
      clientAlive = false
      // Leaving the page disconnects the stream, but the durable generation session keeps
      // running. Only the explicit Stop endpoint marks the session for cancellation.
      const session = recoverySession
        ? await prisma.articleGenerationSession.findUnique({
            where: { id: recoverySession.id },
            select: { failureReason: true },
          })
        : null
      if (session?.failureReason !== 'USER_STOP_REQUESTED') return
      abortController.abort()
      await auditAttempt('MANUAL_GENERATION_CANCELLED', {
        stage: generation ? (textDone ? 'finalization' : 'writing') : 'initialization',
        reason: reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : null,
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
})
