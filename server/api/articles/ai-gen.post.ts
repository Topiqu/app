export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const { prompt } = await readValidatedBody(
    event,
    z.object({ prompt: z.string().nonempty('Prompt is required') }).parse,
  )

  const { usage, ...article } = await generateArticle(user.clientSiteId, prompt)

  await prisma.clientSite.update({
    data: { tokenRemaining: { decrement: usage.totalTokens } },
    where: { id: user.clientSiteId },
  })

  await logAction({
    action: 'GENERATE_ARTICLE',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    metadata: article,
    ip: getIp(event),
  })

  return article
})
