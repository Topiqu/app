import prisma from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const draft = await prisma.draftPost.update({
    where: { id },
    data: { status: 'REJECTED' },
  })

  await prisma.approval.create({
    data: {
      draftId: draft.id,
      reviewerId: 'system', // Replace with actual user ID
      decision: 'REJECT',
      notes: body.reason || null,
    },
  })

  return { success: true, draft }
})
