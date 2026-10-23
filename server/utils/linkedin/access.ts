import type { H3Event } from 'h3'

export async function requirePublicationDraft(event: H3Event) {
  const { translate: t } = await useServerI18n(event)
  const { user, membership } = await requireTenantScope(event, 'INTEGRATION_CONTROL')
  if (!membership.clientSiteId || (user.role !== 'admin' && user.role !== 'superadmin'))
    throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  const db = await getEnhancedPrisma(user)
  const draft = await db.draftPost.findFirst({
    where: {
      id,
      deletedAt: null,
      task: { deletedAt: null, company: { deletedAt: null, clientSiteId: membership.clientSiteId } },
    },
    select: {
      id: true,
      task: { select: { company: { select: { clientSite: { select: { publishToLinkedIn: true } } } } } },
    },
  })
  if (!draft) throw createError({ statusCode: 404, message: t('common.errors.notFound')! })
  return { user, clientSiteId: membership.clientSiteId, draft, translate: t }
}
