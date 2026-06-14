import prisma from '../../utils/prisma'
import { publishApprovedDraft } from '../../utils/linkedin/publisher'

export default defineEventHandler(async (event) => {
  if (getHeader(event, 'Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const drafts = await prisma.draftPost.findMany({
    where: { status: 'APPROVED' },
    select: { id: true },
  })

  const results = await Promise.allSettled(drafts.map((d) => publishApprovedDraft(d.id)))

  let published = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      if (r.value.status === 'published') published++
    } else {
      console.error(`Failed to publish draft ${drafts[i]!.id}`, r.reason)
    }
  })

  return { success: true, scanned: drafts.length, published }
})
