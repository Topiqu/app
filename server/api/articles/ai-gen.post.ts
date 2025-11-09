export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const { prompt } = await readValidatedBody(
    event,
    z.object({ prompt: z.string().nonempty(t('common.errors.missing')!) }).parse,
  )

  const { usage, ...article } = await generateArticle(user.clientSiteId, prompt)

  await prisma.clientSite.update({
    data: { tokenRemaining: { decrement: usage.totalTokens }, totalUsage: { increment: usage.totalTokens } },
    where: { id: user.clientSiteId },
  })

  await logAction({
    action: 'GENERATE_ARTICLE',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    metadata: { ...article, usage },
    ip: getIp(event),
  })

  return article
})
