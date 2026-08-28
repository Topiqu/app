export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'INTEGRATION_CONTROL', user.clientSiteId)
  const logId = getRouterParam(event, 'logId')
  if (!logId) throw createError({ statusCode: 400, message: 'Missing action ID' })

  const entry = await db.log.findFirst({
    where: {
      id: logId,
      clientSiteId: user.clientSiteId!,
      action: { in: ['SEO_AUTOPILOT_CTR_OPTIMIZED', 'SEO_AUTOPILOT_CONTENT_REFRESHED'] },
    },
    select: { action: true, metadata: true },
  })
  if (!entry) throw createError({ statusCode: 404, message: 'Autopilot action not found' })

  const metadata = entry.metadata as {
    articleId?: unknown
    before?: {
      title?: unknown
      excerpt?: unknown
      content?: unknown
      totalWords?: unknown
      savedAmount?: unknown
      savedTimeMinutes?: unknown
    }
    after?: { title?: unknown; excerpt?: unknown; content?: unknown }
  } | null
  if (typeof metadata?.articleId !== 'string' || !metadata.before || !metadata.after)
    throw createError({ statusCode: 409, message: 'This action has no rollback snapshot' })

  const article = await db.article.findUnique({
    where: { id: metadata.articleId },
    select: { id: true, title: true, excerpt: true, content: true, status: true },
  })
  if (!article) throw createError({ statusCode: 404, message: 'Article not found' })

  let data: {
    title?: string
    excerpt?: string | null
    content?: string
    totalWords?: number | null
    savedAmount?: number
    savedTimeMinutes?: number
  }
  if (entry.action === 'SEO_AUTOPILOT_CTR_OPTIMIZED') {
    if (
      typeof metadata.after.title !== 'string' ||
      article.title !== metadata.after.title ||
      article.excerpt !== metadata.after.excerpt
    )
      throw createError({ statusCode: 409, message: 'The article changed after this action; rollback refused' })
    if (typeof metadata.before.title !== 'string')
      throw createError({ statusCode: 409, message: 'Invalid rollback snapshot' })
    data = {
      title: metadata.before.title,
      excerpt: typeof metadata.before.excerpt === 'string' ? metadata.before.excerpt : null,
    }
  } else {
    if (typeof metadata.after.content !== 'string' || article.content !== metadata.after.content)
      throw createError({ statusCode: 409, message: 'The article changed after this action; rollback refused' })
    if (typeof metadata.before.content !== 'string')
      throw createError({ statusCode: 409, message: 'Invalid rollback snapshot' })
    data = {
      content: metadata.before.content,
      totalWords: typeof metadata.before.totalWords === 'number' ? metadata.before.totalWords : null,
      savedAmount: typeof metadata.before.savedAmount === 'number' ? metadata.before.savedAmount : 0,
      savedTimeMinutes: typeof metadata.before.savedTimeMinutes === 'number' ? metadata.before.savedTimeMinutes : 0,
    }
  }

  await db.article.update({ where: { id: article.id }, data })
  if (article.status === 'published') {
    await syncArticleTranslationQueue(db, article.id, user.clientSiteId!, { contentChanged: true })
    await invalidateFeed(user.clientSiteId!)
  }
  await logAction({
    action: 'SEO_AUTOPILOT_ROLLED_BACK',
    userId: user.id,
    clientSiteId: user.clientSiteId!,
    ip: getIp(event),
    metadata: { sourceLogId: logId, articleId: article.id, restoredFields: Object.keys(data) },
  })

  return { success: true }
})
