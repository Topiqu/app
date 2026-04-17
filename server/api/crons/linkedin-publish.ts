import prisma from '../../utils/prisma'
import { publishDecisionAndExecute } from '../../utils/linkedin/publisher'

export default defineEventHandler(async (event) => {
  if (getHeader(event, 'Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const drafts = await prisma.draftPost.findMany({
    where: { status: 'APPROVED' },
  })

  for (const draft of drafts) {
    try {
      await publishDecisionAndExecute(draft.id)
    } catch (err) {
      console.error(`Failed to publish draft ${draft.id}`, err)
    }
  }

  return { success: true, count: drafts.length }
})
