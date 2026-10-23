import prisma from '../../utils/prisma'
import { mapLimit } from '../../utils/concurrency'
import { publishApprovedDraft } from '../../utils/linkedin/publisher'

export default defineEventHandler(async (event) => {
  requireCron(event)

  const drafts = await prisma.draftPost.findMany({
    where: {
      deletedAt: null,
      task: { deletedAt: null, company: { deletedAt: null } },
      OR: [
        { status: 'APPROVED', task: { company: { clientSite: { publishToLinkedIn: true } } } },
        { status: 'PUBLISHING', publicationUrn: { not: null } },
        { status: 'FAILED', publicationError: null },
      ],
    },
    select: { id: true },
    take: 50,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })

  const results = await mapLimit(drafts, 4, async (draft) => {
    try {
      return await publishApprovedDraft(draft.id)
    } catch {
      await reportCaughtError('LinkedIn publication attempt failed', new Error('LINKEDIN_PUBLISH_FAILED'), {
        draftId: draft.id,
      }).catch(() => {})
      return { status: 'failed' as const }
    }
  })

  return {
    success: true,
    scanned: drafts.length,
    published: results.filter((result) => result.status === 'published').length,
    needsReview: results.filter((result) => result.status === 'needs_review').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    failed: results.filter((result) => result.status === 'failed').length,
  }
})
