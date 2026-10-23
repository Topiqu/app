import { z } from 'zod'

import { isLinkedInPostUrn } from '../../../utils/linkedin/api'
import { requirePublicationDraft } from '../../../utils/linkedin/access'
import { reconcilePublishedDraft } from '../../../utils/linkedin/publisher'

const schema = z
  .object({
    linkedinPostId: z.string().max(80).refine(isLinkedInPostUrn).optional(),
    confirmedPublished: z.literal(true).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.linkedinPostId) === Boolean(body.confirmedPublished))
  .default({})

export default defineEventHandler(async (event) => {
  const { user, clientSiteId, draft, translate: t } = await requirePublicationDraft(event)
  if (!(await consumeRateLimit(`linkedin-reconcile:${clientSiteId}:${user.id}`, 10, 60)))
    throw createError({ statusCode: 429, message: t('common.errors.tooManyRequests')! })
  const body = await readValidatedBody(event, schema.parse)
  try {
    const result = await reconcilePublishedDraft(draft.id, {
      urn: body.linkedinPostId,
      clientSiteId,
      reviewerId: user.id,
    })
    if (result.status === 'skipped') throw createError({ statusCode: 409 })
    if (result.status !== 'published') throw createError({ statusCode: 503 })
    return { success: true, ...result }
  } catch (error) {
    const conflict = error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409
    throw createError({ statusCode: conflict ? 409 : 503, message: t('articles.workflowDrafts.reconciliationFailed')! })
  }
})
