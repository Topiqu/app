import type { DraftStatus } from '@prisma/client'

import prisma from '../prisma'
import { createPost } from './api'

const PUBLISHABLE_FROM: DraftStatus[] = ['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'FAILED']

export async function executePublish(draftId: string, fromStatuses: DraftStatus[]) {
  if (process.env.GLOBAL_KILL_SWITCH === 'true') {
    throw new Error('Global emergency stop is active. Publishing disabled.')
  }

  const { count } = await prisma.draftPost.updateMany({
    where: { id: draftId, status: { in: fromStatuses } },
    data: { status: 'PUBLISHING' },
  })
  if (count === 0) return { status: 'skipped' as const }

  try {
    const draft = await prisma.draftPost.findUniqueOrThrow({
      where: { id: draftId },
      include: { task: { include: { company: true } } },
    })

    const { company } = draft.task
    if (!company.accessToken) throw new Error('No LinkedIn access token for company.')

    const urn = await createPost(company.accessToken, company.linkedinOrgId, draft.text)

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
    include: { task: { include: { company: true } } },
  })

  if (!draft) throw new Error(`Draft ${draftId} not found`)

  if (draft.task.company.mode === 'FullAuto' && draft.score >= 70) {
    return executePublish(draftId, PUBLISHABLE_FROM)
  }

  await prisma.draftPost.update({
    where: { id: draftId },
    data: { status: 'AWAITING_APPROVAL' },
  })
  return { status: 'awaiting_approval' as const }
}
