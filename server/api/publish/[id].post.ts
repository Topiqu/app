import { requirePublicationDraft } from '../../utils/linkedin/access'
import { publishDecisionAndExecute } from '../../utils/linkedin/publisher'

export default defineEventHandler(async (event) => {
  const { user, clientSiteId, draft, translate: t } = await requirePublicationDraft(event)
  if (draft.task.company.clientSite.publishToLinkedIn === false)
    throw createError({ statusCode: 403, message: t('common.errors.publicationChannelDisabled')! })
  if (!(await consumeRateLimit(`linkedin-publish:${clientSiteId}:${user.id}`, 5, 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })

  try {
    const result = await publishDecisionAndExecute(draft.id)
    return { success: true, ...result }
  } catch {
    throw createError({ statusCode: 503, message: t('articles.workflowDrafts.publishFailed')! })
  }
})
