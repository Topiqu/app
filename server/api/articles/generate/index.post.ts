export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !user.clientSiteId) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }

  await ensureMinAccountAge(event, user.id)

  const { prompt } = await readValidatedBody(
    event,
    z.object({
      prompt: z.string().nonempty(t('common.errors.missing')!),
    }).parse,
  )

  const client = await prisma.clientSite.findUnique({
    where: { id: user.clientSiteId },
    select: { humanHourlyRateUsd: true, humanWordsPerHour: true },
  })

  if (!client) {
    throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })
  }

  const clientSiteId = user.clientSiteId
  const abortController = new AbortController()
  let textDone = false

  // Client disconnect (tab close) or explicit Stop → cancel the LLM, but only while it's
  // still writing. Once the text is done we always finish finalize + billing server-side,
  // so a drop near the end can never skip the charge.
  const onClose = () => {
    if (!textDone) abortController.abort()
  }
  event.node.req.on('close', onClose)

  const { result, finalize } = await streamArticle(clientSiteId, prompt, abortController.signal)

  setResponseHeader(event, 'Content-Type', 'application/x-ndjson; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

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

  return new ReadableStream({
    async start(controller) {
      try {
        send(controller, { type: 'phase', phase: 'writing' })

        for await (const partial of result.partialObjectStream) {
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
            await reportError('Article finalization failed', error, { clientSiteId })
            return { ...object, content: stripContentSlots(object.content), articleImageUrl: '' }
          },
        )
        const metrics = calculateArticleMetrics(finalized.content, client.humanHourlyRateUsd, client.humanWordsPerHour)

        // Handed over before billing. `consumeClientTokens` throws on a negative balance, and it
        // threw *after* the decrement and *before* this send — so the one generation that emptied
        // the wallet was charged and then thrown away.
        send(controller, { type: 'final', article: { ...finalized, metrics, aiInvolvement: 'FULL' } })

        await consumeClientTokens(
          clientSiteId,
          usage.totalTokens || 0,
          'GENERATE_ARTICLE',
          { ...finalized, usage, metrics, aiInvolvement: 'FULL', createdAt: new Date() },
          event,
        )
      } catch (error: any) {
        if (abortController.signal.aborted) {
          // Stopped mid-generation: bill best-effort for the partial usage we actually spent.
          const usage = await result.usage.catch(() => null)
          if (usage?.totalTokens) {
            await consumeClientTokens(clientSiteId, usage.totalTokens, 'GENERATE_ARTICLE', { aborted: true }, event).catch(
              () => {},
            )
          }
        } else {
          // The response is already a 200 with a half-written body, so this can never reach Nitro's
          // `error` hook and Sentry never sees a caught throw — without this the author got a
          // generic toast and production had no record at all.
          await reportError('Article generation stream failed', error, { clientSiteId })
          send(controller, { type: 'error', message: error?.message || t('articles.editor.aiContentFailed') })
        }
      } finally {
        event.node.req.off('close', onClose)
        try {
          controller.close()
        } catch {
          // already closed by the client
        }
      }
    },
    cancel() {
      if (!textDone) abortController.abort()
    },
  })
})
