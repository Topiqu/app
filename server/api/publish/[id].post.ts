import { publishDecisionAndExecute } from '../../utils/linkedin/publisher'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user

  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const draft = await db.draftPost.findUnique({
    where: { id },
    select: { task: { select: { company: { select: { clientSiteId: true } } } } },
  })
  if (!draft) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  const siteId = draft.task.company.clientSiteId
  const allowed = user.role === 'superadmin' || (user.role === 'admin' && user.clientSiteId === siteId)
  if (!allowed) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })

  try {
    const result = await publishDecisionAndExecute(id)
    return { success: true, ...result }
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
