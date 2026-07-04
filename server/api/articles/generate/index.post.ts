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
    select: { humanHourlyRate: true, humanWordsPerHour: true },
  })

  if (!client) {
    throw createError({ statusCode: 404, message: t('common.errors.clientNotFound')! })
  }

  const clientSiteId = user.clientSiteId
  const { result, finalize } = await streamArticle(clientSiteId, prompt)

  setResponseHeader(event, 'Content-Type', 'application/x-ndjson; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const encoder = new TextEncoder()
  const send = (controller: ReadableStreamDefaultController, payload: unknown) =>
    controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const partial of result.partialObjectStream) {
          send(controller, { type: 'partial', object: partial })
        }

        const object = await result.object
        const usage = await result.usage
        const finalized = await finalize(object)
        const metrics = calculateArticleMetrics(finalized.content, client.humanHourlyRate, client.humanWordsPerHour)

        await consumeClientTokens(
          clientSiteId,
          usage.totalTokens || 0,
          'GENERATE_ARTICLE',
          { ...finalized, usage, metrics, aiInvolvement: 'FULL', createdAt: new Date() },
          event,
        )

        send(controller, { type: 'final', article: { ...finalized, metrics, aiInvolvement: 'FULL' } })
      } catch (error: any) {
        send(controller, { type: 'error', message: error?.message || t('articles.editor.aiContentFailed') })
      } finally {
        controller.close()
      }
    },
  })
})
