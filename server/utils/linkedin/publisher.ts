import type { DraftStatus } from '~~/generated/zenstack/models'

import prisma from '../prisma'
import { createPost } from './api'
import { getValidAccessToken } from './token'

const PUBLISHABLE_FROM: DraftStatus[] = ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'FAILED']

export async function executePublish(draftId: string, fromStatuses: DraftStatus[]) {
  if (process.env.GLOBAL_KILL_SWITCH === 'true') {
    throw new Error('Global emergency stop is active. Publishing disabled.')
  }

  const pending = await prisma.draftPost.findUnique({ where: { id: draftId }, select: { status: true } })
  if (!pending || !fromStatuses.includes(pending.status)) return { status: 'skipped' as const }
  const { count } = await prisma.draftPost.updateMany({
    where: {
      id: draftId,
      status: pending.status,
      task: { company: { clientSite: { publishToLinkedIn: true } } },
    },
    data: { status: 'PUBLISHING' },
  })
  if (count === 0) return { status: 'skipped' as const }

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
        where: { id: draftId, status: 'PUBLISHING' },
        data: { status: pending.status },
      })
      return { status: 'skipped' as const }
    }
    const accessToken = await getValidAccessToken(company)

    const urn = await createPost(accessToken, company.linkedinOrgId, draft.text)

    await prisma.$transaction([
      prisma.publishedPost.create({ data: { draftId, linkedinPostId: urn } }),
      prisma.draftPost.update({ where: { id: draftId }, data: { status: 'PUBLISHED' } }),
    ])

    return { status: 'published' as const, urn }
  } catch (err) {
    await prisma.draftPost.update({ where: { id: draftId }, data: { status: 'FAILED' } })
    throw err
  }
}

export function publishApprovedDraft(draftId: string) {
  return executePublish(draftId, ['APPROVED'])
}

export async function publishDecisionAndExecute(draftId: string) {
  const draft = await prisma.draftPost.findUnique({
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

  if (!draft) throw new Error(`Draft ${draftId} not found`)
  if (draft.task.company.clientSite.publishToLinkedIn === false) return { status: 'skipped' as const }

  if (draft.task.company.mode === 'FullAuto' && draft.score >= 70) {
    return executePublish(draftId, PUBLISHABLE_FROM)
  }

  await prisma.draftPost.update({
    where: { id: draftId },
    data: { status: 'AWAITING_APPROVAL' },
  })
  return { status: 'awaiting_approval' as const }
}
