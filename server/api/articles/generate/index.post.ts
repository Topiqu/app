export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user

  if (!user || !user.clientSiteId) {
    throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })
  }

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

  const { usage, ...article } = await generateArticle(user.clientSiteId, prompt)

  const metrics = calculateArticleMetrics(article.content, client.humanHourlyRate, client.humanWordsPerHour)

  await consumeClientTokens(
    user.clientSiteId,
    usage.totalTokens || 0,
    'GENERATE_ARTICLE',
    {
      ...article,
      usage,
      metrics,
      aiInvolvement: 'FULL',
      createdAt: new Date(),
    },
    event,
  )

  return {
    ...article,
    metrics,
    aiInvolvement: 'FULL',
  }
})
