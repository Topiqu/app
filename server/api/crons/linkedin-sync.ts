import prisma from '../../utils/prisma'
import { getPostMetrics } from '../../utils/linkedin/api'

export default defineEventHandler(async (event) => {
  if (getHeader(event, 'Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const posts = await prisma.publishedPost.findMany({
    include: {
      draft: {
        include: {
          task: {
            include: { company: true },
          },
        },
      },
    },
  })

  for (const post of posts) {
    const company = post.draft.task.company
    if (!company.accessToken) continue

    try {
      const metrics = await getPostMetrics(company.accessToken, post.linkedinPostId)

      await prisma.postMetric.create({
        data: {
          publishedPostId: post.id,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          reactions: metrics.likes,
          comments: metrics.comments,
        },
      })
    } catch (err) {
      console.error(`Failed to sync metrics for post ${post.id}`, err)
    }
  }

  return { success: true, count: posts.length }
})
