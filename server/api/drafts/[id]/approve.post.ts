import prisma from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  const draft = await prisma.draftPost.update({
    where: { id },
    data: { status: 'APPROVED' },
  })

  // We record the approval decision
  // Assuming auth is set up and we have a user
  // const session = await requireAuthSession(event)

  await prisma.approval.create({
    data: {
      draftId: draft.id,
      reviewerId: 'system', // Replace with actual user ID from session
      decision: 'APPROVE',
    },
  })

  return { success: true, draft }
})
