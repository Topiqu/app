import { createError } from 'h3'

export async function decideDraft(input: {
  db: Awaited<ReturnType<typeof getEnhancedPrisma>>
  draftId: string
  clientSiteId: string
  reviewerId: string
  decision: 'APPROVE' | 'REJECT'
  notes?: string
  translate: (key: string) => string | undefined
}) {
  const { db, draftId, clientSiteId, reviewerId, decision, notes, translate: t } = input
  return db.$transaction(async (tx) => {
    const where = {
      id: draftId,
      deletedAt: null,
      task: { deletedAt: null, company: { clientSiteId, deletedAt: null } },
    }
    const draft = await tx.draftPost.findFirst({ where, select: { id: true, status: true } })
    if (!draft) throw createError({ statusCode: 404, message: t('common.errors.notFound') || undefined })
    if (draft.status !== 'DRAFT' && draft.status !== 'AWAITING_APPROVAL') {
      throw createError({ statusCode: 409, message: t('common.errTypes.conflict') || undefined })
    }

    const status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    const updated = await tx.draftPost.updateMany({
      where: { ...where, status: draft.status },
      data: { status },
    })
    if (updated.count !== 1) {
      throw createError({ statusCode: 409, message: t('common.errTypes.conflict') || undefined })
    }
    await tx.approval.create({
      data: { draftId, reviewerId, decision, notes: notes ?? null },
      select: { id: true },
    })
    return { id: draft.id, status }
  })
}
