export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing generation session id' })

  const result = await prisma.articleGenerationSession.updateMany({
    where: {
      id,
      userId: user.id,
      clientSiteId: user.clientSiteId!,
      status: { in: ['RESERVED', 'RESEARCHING', 'WRITING', 'FINALIZING'] },
    },
    data: { failureReason: 'USER_STOP_REQUESTED' },
  })
  if (!result.count) throw createError({ statusCode: 404, message: 'Running generation not found' })
  return { stopRequested: true }
})
