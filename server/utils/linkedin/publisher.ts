import prisma from '../prisma'
import { createPost } from './api'

export async function publishDecisionAndExecute(draftId: string) {
  const draft = await prisma.draftPost.findUnique({
    where: { id: draftId },
    include: {
      task: {
        include: {
          company: true,
        },
      },
    },
  })

  if (!draft) throw new Error(`Draft ${draftId} not found`)

  const company = draft.task.company

  if ((process as any).env?.GLOBAL_KILL_SWITCH === 'true') {
    throw new Error('Global emergency stop is active. Publishing disabled.')
  }

  if (company.mode === 'FullAuto' && draft.score >= 70) {
    if (!company.accessToken) {
      throw new Error('No LinkedIn access token for company.')
    }
    const urn = await createPost(company.accessToken, company.linkedinOrgId, draft.text)

    await prisma.publishedPost.create({
      data: {
        draftId: draft.id,
        linkedinPostId: urn,
      },
    })

    await prisma.draftPost.update({
      where: { id: draft.id },
      data: { status: 'PUBLISHED' },
    })

    return { status: 'published', urn }
  } else {
    await prisma.draftPost.update({
      where: { id: draft.id },
      data: { status: 'AWAITING_APPROVAL' },
    })
    return { status: 'awaiting_approval' }
  }
}
