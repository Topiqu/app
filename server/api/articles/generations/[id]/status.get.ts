export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing generation session id' })
  const session = await prisma.articleGenerationSession.findFirst({
    where: { id, userId: user.id, clientSiteId: user.clientSiteId! },
    select: { status: true, recoverableSnapshot: true, failureReason: true },
  })
  if (!session) throw createError({ statusCode: 404, message: 'Generation session not found' })
  return session
})
