import { generationRecoveryMatchesArticle } from '~~/shared/utils/generationRecoveryScope'

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const articleId = getQuery(event).articleId
  if (typeof articleId !== 'string' || (articleId !== 'new' && !/^[0-9a-f-]{36}$/i.test(articleId)))
    throw createError({ statusCode: 400, message: 'Invalid article id' })
  let cursor: string | undefined
  for (;;) {
    const sessions = await prisma.articleGenerationSession.findMany({
      where: {
        userId: user.id,
        clientSiteId: user.clientSiteId!,
        usefulResultAt: { not: null },
        restoredAt: null,
        dismissedAt: null,
        status: { in: ['COMPLETED', 'INTERRUPTED', 'FAILED', 'FINALIZING', 'WRITING'] },
      },
      orderBy: [{ lastCheckpointAt: 'desc' }, { id: 'desc' }],
      take: 50,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        status: true,
        recoverableSnapshot: true,
        lastCheckpointAt: true,
        charged: true,
        failureReason: true,
        options: true,
      },
    })
    const session = sessions.find((item) => generationRecoveryMatchesArticle(item.options, articleId))
    if (session) {
      const { options: _options, ...result } = session
      return result
    }
    if (sessions.length < 50) return null
    cursor = sessions.at(-1)!.id
  }
})
