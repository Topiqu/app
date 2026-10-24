export default defineEventHandler(async (event): Promise<ArticleBackgroundTask[]> => {
  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const db = await getEnhancedPrisma(user)
  const since = new Date(Date.now() - 24 * 60 * 60_000)
  const [generations, translations] = await Promise.all([
    // Generation receipts deny all ORM access; like the status/recovery routes, read only this actor's tenant-scoped receipts.
    prisma.articleGenerationSession.findMany({
      where: {
        clientSiteId: user.clientSiteId!,
        userId: user.id,
        restoredAt: null,
        dismissedAt: null,
        status: { in: ['RESERVED', 'RESEARCHING', 'WRITING', 'FINALIZING', 'COMPLETED', 'FAILED', 'INTERRUPTED'] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, options: true, recoverableSnapshot: true, createdAt: true, updatedAt: true },
    }),
    db.articleTranslation.findMany({
      where: {
        clientSiteId: user.clientSiteId!,
        deletedAt: null,
        updatedAt: { gte: since },
        OR: [{ source: 'AI' }, { translationStartedAt: { not: null } }, { error: { not: null } }],
        status: { in: ['PENDING', 'TRANSLATING', 'READY', 'PUBLISHED', 'FAILED'] },
        article: {
          clientSiteId: user.clientSiteId!,
          deletedAt: null,
          ...(!hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS') ? { userId: user.id } : {}),
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        translationStartedAt: true,
        error: true,
        language: true,
        createdAt: true,
        updatedAt: true,
        article: { select: { title: true, slug: true } },
      },
    }),
  ])
  const sourceId = (options: unknown) =>
    options &&
    typeof options === 'object' &&
    'sourceArticleId' in options &&
    typeof options.sourceArticleId === 'string'
      ? options.sourceArticleId
      : null
  const ids = generations.flatMap((session) => (sourceId(session.options) ? [sourceId(session.options)!] : []))
  const articles = ids.length
    ? await db.article.findMany({
        where: { id: { in: ids }, clientSiteId: user.clientSiteId!, deletedAt: null },
        select: { id: true, slug: true },
      })
    : []
  const slugs = new Map(articles.map((article) => [article.id, article.slug]))
  return [
    ...generations.map((session): ArticleBackgroundTask => {
      const snapshot = session.recoverableSnapshot
      return {
        id: session.id,
        kind: 'generation',
        status:
          session.status === 'COMPLETED'
            ? 'completed'
            : session.status === 'FAILED'
              ? 'failed'
              : session.status === 'INTERRUPTED'
                ? 'stopped'
                : 'running',
        title:
          snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && typeof snapshot.title === 'string'
            ? snapshot.title
            : null,
        slug: slugs.get(sourceId(session.options) ?? '') ?? null,
        language: null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: (session.updatedAt ?? session.createdAt).toISOString(),
      }
    }),
    ...translations.map((translation): ArticleBackgroundTask => ({
      id: translation.id,
      kind: 'translation',
      status:
        translation.translationStartedAt || ['PENDING', 'TRANSLATING'].includes(translation.status)
          ? 'running'
          : translation.status === 'FAILED' || translation.error
            ? 'failed'
            : 'completed',
      title: translation.article.title,
      slug: translation.article.slug,
      language: translation.language,
      createdAt: translation.createdAt.toISOString(),
      updatedAt: (translation.updatedAt ?? translation.createdAt).toISOString(),
    })),
  ]
    .sort(
      (a, b) =>
        Number(b.status === 'running') - Number(a.status === 'running') || b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, 12)
})
