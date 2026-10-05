import { z } from 'zod'
import {
  applyContentAction,
  dismissContentAction,
  queueContentAction,
  rollbackContentAction,
} from '~~/server/utils/keywords/refresh'

export default defineEventHandler(async (event) => {
  const { user, db } = await requireDb(event, { role: ['admin', 'superadmin'], clientSite: true })
  const clientSiteId = user.clientSiteId!

  const id = getRouterParam(event, 'id')!
  const { action } = await readValidatedBody(
    event,
    z.object({ action: z.enum(['prepare', 'apply', 'dismiss', 'rollback']) }).parse,
  )
  // The tenant filter makes a foreign id a 404, not someone else's article.
  const target = await db.contentAction.findFirst({
    where: { id, clientSiteId },
    select: {
      id: true,
      clientSiteId: true,
      status: true,
      proposal: true,
      snapshot: true,
      article: { select: { userId: true } },
    },
  })
  if (!target) throw createError({ statusCode: 404, message: 'Suggestion not found' })
  if (user.role !== 'superadmin') {
    const { membership } = await requireTenantScope(event, 'ARTICLE_WRITE', clientSiteId)
    if (target.article.userId !== user.id && !hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS'))
      throw createError({ statusCode: 403, message: 'Missing tenant scope: ARTICLE_WRITE_OTHERS' })
    if (action === 'prepare') await requireTenantScope(event, 'AI_USE', clientSiteId)
    if (action === 'apply' || action === 'rollback') await requireTenantScope(event, 'ARTICLE_PUBLISH', clientSiteId)
  }

  if (action === 'prepare') {
    if (!(await hasActiveFeature(db, clientSiteId, 'AI')))
      throw createError({ statusCode: 403, message: 'AI is not enabled for this tenant' })
    const site = await db.clientSite.findUnique({ where: { id: clientSiteId }, select: { plan: true } })
    await queueContentAction(db, target, site?.plan ?? null)
    // The cron picks it up within five minutes anyway; this only saves the wait.
    runTask('content-actions').catch((error: Error) =>
      console.error('[content-actions] Immediate run failed:', error.message),
    )
  } else if (action === 'apply') await applyContentAction(db, target, user.id)
  else if (action === 'rollback') await rollbackContentAction(db, target, user.id)
  else await dismissContentAction(db, target)

  return { success: true }
})
