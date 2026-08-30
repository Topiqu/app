import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import {
  ARTICLE_GENERATION_FORMATS,
  ARTICLE_GENERATION_MODULES,
  RESEARCH_DEPTHS,
} from '~~/shared/utils/articleGeneration'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !user.clientSiteId) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }
  await requireTenantScope(event, 'AI_USE', user.clientSiteId)
  await requireTenantScope(event, 'ARTICLE_WRITE', user.clientSiteId)

  await ensureMinAccountAge(event, user.id)

  const { prompt, options } = await readValidatedBody(
    event,
    z.object({
      prompt: z.string().nonempty(t('common.errors.missing')!),
      options: z
        .object({
          format: z.enum(ARTICLE_GENERATION_FORMATS),
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
  const attemptId = randomUUID()
  const auditAttempt = async (action: string, metadata: Record<string, unknown> = {}) => {
    try {
      await logAction({
        action,
        userId: user.id,
        clientSiteId,
        ip: getIp(event),
        metadata: { attemptId, ...metadata },
      })
    } catch (error) {
      await reportCaughtError('Manual generation audit logging failed', error, { action, attemptId, clientSiteId })
    }
  }

  await auditAttempt('MANUAL_GENERATION_STARTED', { promptLength: prompt.length })

  const client = await prisma.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { plan: true, humanHourlyRateUsd: true, humanWordsPerHour: true },
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
  let writerFirstPartialTimer: ReturnType<typeof setTimeout> | undefined
  let timedOutStage: 'writer_first_partial' | null = null

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

  const stream = new ReadableStream({
    async start(controller) {
      // Bun closes an HTTP connection after 10 seconds without bytes by default. Research and the
      // writer's time-to-first-token can both exceed that, so keep the response active below both
      // Bun's idle timeout and Cloudflare's proxy timeout while useful work is still running.
      const heartbeat = setInterval(() => send(controller, { type: 'heartbeat' }), 5_000)

      try {
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
          abortSignal: abortController.signal,
          research: options?.research.enabled === false ? false : undefined,
          researchDepth: options?.research.depth,
          fallbackWithoutResearch: options?.research.fallbackWithoutResearch,
          format: options?.format,
          modules: options?.modules,
        })
        const { result, finalize, researchTokens, research } = generation
        send(controller, { type: 'research', ...research })
        send(controller, { type: 'phase', phase: 'writing' })
        await auditAttempt('MANUAL_GENERATION_WRITER_STARTED', { researchTokens, research })

        writerFirstPartialTimer = setTimeout(() => {
          timedOutStage = 'writer_first_partial'
          abortController.abort()
        }, 90_000)

        for await (const partial of result.partialObjectStream) {
          if (writerFirstPartialTimer) {
            clearTimeout(writerFirstPartialTimer)
            writerFirstPartialTimer = undefined
          }
          send(controller, { type: 'partial', object: partial })
        }
        textDone = true

        const object = await result.object
        const usage = await result.usage

        send(controller, { type: 'phase', phase: 'images' })

        // Finalization is the only step that fills `[[IMAGEn]]`/`[[POLLn]]`, so its failure used to
        // reach the author as an article full of raw markers. It is best-effort now: the text is
        // written and already billable, and one dead image call must not cost the whole draft.
        const finalized = await finalize(object, (image) => send(controller, { type: 'image', ...image })).catch(
          async (error) => {
            await reportCaughtError('Article finalization failed', error, { clientSiteId })
            return {
              ...object,
              content: stripContentSlots(object.content),
              articleImageUrl: '',
              articleImageCredit: null,
            }
          },
        )
        const metrics = calculateArticleMetrics(finalized.content, client.humanHourlyRateUsd, client.humanWordsPerHour)

        // Handed over before billing. `consumeClientTokens` throws on a negative balance, and it
        // threw *after* the decrement and *before* this send — so the one generation that emptied
        // the wallet was charged and then thrown away.
        send(controller, { type: 'final', article: { ...finalized, metrics, aiInvolvement: 'ASSIST' } })

        await consumeClientTokens(
          clientSiteId,
          (usage.totalTokens || 0) + researchTokens,
          'MANUAL_GENERATION_COMPLETED',
          {
            attemptId,
            title: finalized.title,
            usage,
            researchTokens,
            metrics,
            aiInvolvement: 'ASSIST',
            createdAt: new Date(),
          },
          event,
          user.id,
        )
      } catch (error: any) {
        if (abortController.signal.aborted && !timedOutStage) {
          // Stopped mid-generation: bill best-effort for the partial usage we actually spent.
          // Research is included because it completes before the first token streams, so Stop
          // never gets it back.
          const usage = await generation?.result.usage.catch(() => null)
          if (usage?.totalTokens) {
            try {
              await consumeClientTokens(
                clientSiteId,
                usage.totalTokens + (generation?.researchTokens ?? 0),
                'MANUAL_GENERATION_ABORTED',
                { attemptId, stage: textDone ? 'finalization' : 'writing' },
                event,
                user.id,
              )
            } catch (billingError) {
              await auditAttempt('MANUAL_GENERATION_ABORTED', {
                stage: textDone ? 'finalization' : 'writing',
                billingError: billingError instanceof Error ? billingError.message : String(billingError),
              })
              await reportCaughtError('Aborted article generation billing failed', billingError, {
                attemptId,
                clientSiteId,
              })
            }
          } else {
            await auditAttempt('MANUAL_GENERATION_ABORTED', {
              stage: textDone ? 'finalization' : 'writing',
              apiTokens: 0,
            })
          }
        } else {
          // The response is already a 200 with a half-written body, so this can never reach Nitro's
          // `error` hook and Sentry never sees a caught throw — without this the author got a
          // generic toast and production had no record at all.
          await auditAttempt('MANUAL_GENERATION_FAILED', {
            stage: timedOutStage ?? (generation ? (textDone ? 'finalization' : 'writing') : 'research'),
            error: timedOutStage
              ? 'Timed out before the writer produced its first partial'
              : error?.message || String(error),
          })
          await reportCaughtError('Article generation stream failed', error, { attemptId, clientSiteId, timedOutStage })
          send(controller, {
            type: 'error',
            message: timedOutStage
              ? 'AI generation timed out before producing content.'
              : error?.message || t('articles.editor.aiContentFailed'),
          })
        }
      } finally {
        clearInterval(heartbeat)
        if (writerFirstPartialTimer) clearTimeout(writerFirstPartialTimer)
        try {
          controller.close()
        } catch {
          // already closed by the client
        }
      }
    },
    async cancel(reason) {
      if (!textDone) abortController.abort()
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
