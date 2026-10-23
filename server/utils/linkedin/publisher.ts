import type { DraftStatus } from '~~/generated/zenstack/models'

import { createError } from 'h3'

import prisma from '../prisma'

const PUBLISHABLE_FROM: DraftStatus[] = ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'FAILED']
const publicationSelect = {
  status: true,
  publicationAttemptedAt: true,
  publicationUrn: true,
  publicationError: true,
  published: { select: { linkedinPostId: true } },
} as const
const safeToRetry = (code: string | null) =>
  code === 'PREPARATION_FAILED' || /^REJECTED_(400|401|403|404|405|410|411|413|414|415|426)$/.test(code || '')

const reportPublication = (draftId: string, code: string, urn?: string) =>
  reportCaughtError('LinkedIn publication needs review', new Error(code), { draftId, ...(urn ? { urn } : {}) }).catch(
    () => {},
  )

const retainPublicationLock = async (draftId: string, code: string, urn?: string) => {
  await prisma.draftPost
    .updateMany({
      where: {
        id: draftId,
        status: 'PUBLISHING',
        ...(urn ? { OR: [{ publicationUrn: null }, { publicationUrn: urn }] } : {}),
      },
      data: { publicationError: code, ...(urn ? { publicationUrn: urn } : {}) },
    })
    .catch(() => {})
  await reportPublication(draftId, code, urn)
  return { status: 'needs_review' as const }
}

const finalizePublication = async (draftId: string, urn: string, clientSiteId?: string) => {
  if (!isLinkedInPostUrn(urn)) return retainPublicationLock(draftId, 'PUBLICATION_ID_INVALID')
  try {
    return await prisma.$transaction(async (tx) => {
      // Updating the draft row serializes local reconciliation without another POST.
      const claimed = await tx.draftPost.updateMany({
        where: {
          id: draftId,
          status: 'PUBLISHING',
          publicationUrn: urn,
          ...(clientSiteId ? { task: { company: { clientSiteId } } } : {}),
        },
        data: { status: 'PUBLISHED', publicationError: null },
      })
      const published = await tx.publishedPost.findUnique({ where: { draftId }, select: { linkedinPostId: true } })
      if (published && published.linkedinPostId !== urn) throw new Error('PUBLICATION_ID_CONFLICT')
      if (claimed.count !== 1 && !published) throw new Error('PUBLICATION_STATE_CONFLICT')
      if (!published) await tx.publishedPost.create({ data: { draftId, linkedinPostId: urn } })
      return { status: 'published' as const, urn }
    })
  } catch {
    return retainPublicationLock(draftId, 'LOCAL_FINALIZATION_FAILED', urn)
  }
}

export async function reconcilePublishedDraft(
  draftId: string,
  manual?: { urn?: string; clientSiteId: string; reviewerId: string },
) {
  const draft = await prisma.draftPost.findUnique({
    where: { id: draftId, ...(manual ? { task: { company: { clientSiteId: manual.clientSiteId } } } : {}) },
    select: publicationSelect,
  })
  if (!draft) return { status: 'skipped' as const }
  if (draft.published) {
    if (draft.publicationUrn && draft.publicationUrn !== draft.published.linkedinPostId)
      return retainPublicationLock(draftId, 'PUBLICATION_ID_CONFLICT')
    if (draft.status !== 'PUBLISHED') {
      await prisma.draftPost.updateMany({
        where: {
          id: draftId,
          status: draft.status,
          ...(manual ? { task: { company: { clientSiteId: manual.clientSiteId } } } : {}),
        },
        data: { status: 'PUBLISHED', publicationUrn: draft.published.linkedinPostId, publicationError: null },
      })
    }
    return { status: 'published' as const, urn: draft.published.linkedinPostId }
  }
  if (draft.status !== 'PUBLISHING') return { status: 'skipped' as const }
  if (manual?.urn && !isLinkedInPostUrn(manual.urn)) throw createError({ statusCode: 400 })
  if (draft.publicationUrn) {
    if (manual?.urn && manual.urn !== draft.publicationUrn) throw createError({ statusCode: 409 })
    return finalizePublication(draftId, draft.publicationUrn, manual?.clientSiteId)
  }
  const confirmedUrn = manual?.urn
  if (!confirmedUrn || !manual) return { status: 'needs_review' as const }
  if (draft.publicationAttemptedAt && Date.now() - draft.publicationAttemptedAt.getTime() < 120_000)
    throw createError({ statusCode: 409 })
  await prisma.$transaction(async (tx) => {
    const saved = await tx.draftPost.updateMany({
      where: {
        id: draftId,
        status: 'PUBLISHING',
        publicationUrn: null,
        publicationAttemptedAt: draft.publicationAttemptedAt,
        task: { company: { clientSiteId: manual.clientSiteId } },
      },
      data: { publicationUrn: confirmedUrn, publicationError: 'MANUALLY_CONFIRMED' },
    })
    if (saved.count !== 1) throw createError({ statusCode: 409 })
    await logAction({
      action: 'LINKEDIN_PUBLICATION_RECONCILED',
      userId: manual.reviewerId,
      clientSiteId: manual.clientSiteId,
      metadata: { draftId, linkedinPostId: confirmedUrn, manuallyConfirmed: true },
      idempotencyKey: `linkedin-reconcile:${draftId}:${confirmedUrn}`,
      tx,
    })
  })
  return finalizePublication(draftId, confirmedUrn, manual.clientSiteId)
}

export async function executePublish(draftId: string, fromStatuses: DraftStatus[]) {
  if (process.env.GLOBAL_KILL_SWITCH === 'true') {
    throw new Error('Global emergency stop is active. Publishing disabled.')
  }

  const pending = await prisma.draftPost.findUnique({ where: { id: draftId }, select: publicationSelect })
  if (!pending) return { status: 'skipped' as const }
  if (pending.status === 'PUBLISHING' || pending.status === 'PUBLISHED' || pending.published || pending.publicationUrn)
    return reconcilePublishedDraft(draftId)
  // Old FAILED rows may hide an accepted post. Only new, explicit pre-send or
  // rejection evidence proves another remote create is safe.
  if ((pending.status === 'FAILED' || pending.publicationAttemptedAt) && !safeToRetry(pending.publicationError)) {
    await prisma.draftPost.updateMany({
      where: { id: draftId, status: pending.status },
      data: { status: 'PUBLISHING', publicationError: 'LEGACY_OUTCOME_UNKNOWN' },
    })
    return { status: 'needs_review' as const }
  }
  if (!fromStatuses.includes(pending.status) || !PUBLISHABLE_FROM.includes(pending.status))
    return { status: 'skipped' as const }
  const attemptedAt = new Date()
  const { count } = await prisma.draftPost.updateMany({
    where: {
      id: draftId,
      status: pending.status,
      deletedAt: null,
      publicationUrn: null,
      published: null,
      task: { deletedAt: null, company: { deletedAt: null, clientSite: { publishToLinkedIn: true } } },
    },
    data: { status: 'PUBLISHING', publicationAttemptedAt: attemptedAt, publicationError: 'ATTEMPT_IN_PROGRESS' },
  })
  if (count !== 1) return { status: 'skipped' as const }

  let postStarted = false
  let urn: string | undefined
  try {
    const draft = await prisma.draftPost.findUniqueOrThrow({
      where: { id: draftId },
      include: {
        task: {
          include: {
            company: {
              omit: { accessToken: false, refreshToken: false },
              include: { clientSite: { select: { publishToLinkedIn: true } } },
            },
          },
        },
      },
    })

    const { company } = draft.task
    if (company.clientSite.publishToLinkedIn === false) {
      await prisma.draftPost.updateMany({
        where: { id: draftId, status: 'PUBLISHING', publicationAttemptedAt: attemptedAt },
        data: { status: pending.status, publicationAttemptedAt: null, publicationError: pending.publicationError },
      })
      return { status: 'skipped' as const }
    }
    const accessToken = await getValidAccessToken(company)

    postStarted = true
    urn = await createPost(accessToken, company.linkedinOrgId, draft.text)
    // Journal the confirmed identity before the finalization transaction.
    const saved = await prisma.draftPost.updateMany({
      where: { id: draftId, status: 'PUBLISHING', publicationAttemptedAt: attemptedAt, publicationUrn: null },
      data: { publicationUrn: urn, publicationError: null },
    })
    if (saved.count !== 1) return retainPublicationLock(draftId, 'PUBLICATION_STATE_CONFLICT', urn)
    return finalizePublication(draftId, urn)
  } catch (error) {
    if (!postStarted || (error instanceof LinkedInPostError && error.outcome === 'rejected')) {
      const code =
        postStarted && error instanceof LinkedInPostError ? `REJECTED_${error.httpStatus}` : 'PREPARATION_FAILED'
      await prisma.draftPost.updateMany({
        where: { id: draftId, status: 'PUBLISHING', publicationAttemptedAt: attemptedAt, publicationUrn: null },
        data: { status: 'FAILED', publicationError: code },
      })
      await reportPublication(draftId, code)
      // OAuth/database causes can contain credentials; only this safe code may escape.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(code)
    }
    return retainPublicationLock(draftId, urn ? 'LOCAL_JOURNAL_FAILED' : 'REMOTE_OUTCOME_UNKNOWN', urn)
  }
}

export function publishApprovedDraft(draftId: string) {
  return executePublish(draftId, ['APPROVED'])
}

export async function publishDecisionAndExecute(draftId: string) {
  const draft = await prisma.draftPost.findUnique({
    where: { id: draftId },
    select: {
      ...publicationSelect,
      score: true,
      task: {
        select: {
          company: {
            select: { mode: true, clientSite: { select: { publishToLinkedIn: true } } },
          },
        },
      },
    },
  })

  if (!draft) throw new Error('Draft not found')
  if (draft.status === 'PUBLISHING' || draft.status === 'PUBLISHED' || draft.published || draft.publicationUrn)
    return reconcilePublishedDraft(draftId)
  if ((draft.status === 'FAILED' || draft.publicationAttemptedAt) && !safeToRetry(draft.publicationError))
    return executePublish(draftId, PUBLISHABLE_FROM)
  if (draft.task.company.clientSite.publishToLinkedIn === false) return { status: 'skipped' as const }

  if (draft.task.company.mode === 'FullAuto' && draft.score >= 70) {
    return executePublish(draftId, PUBLISHABLE_FROM)
  }

  const saved = await prisma.draftPost.updateMany({
    where: { id: draftId, status: draft.status, publicationUrn: null, published: null },
    data: { status: 'AWAITING_APPROVAL' },
  })
  return { status: saved.count === 1 ? ('awaiting_approval' as const) : ('skipped' as const) }
}
