import prisma from '../../utils/prisma'
import { getPostMetrics } from '../../utils/linkedin/api'
import { getValidAccessToken } from '../../utils/linkedin/token'

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

  const tokenCache = new Map<string, string>()

  for (const post of posts) {
    const company = post.draft.task.company
    if (!company.accessToken) continue

    try {
      let accessToken = tokenCache.get(company.id)
      if (!accessToken) {
        accessToken = await getValidAccessToken(company)
        tokenCache.set(company.id, accessToken)
      }

      const metrics = await getPostMetrics(accessToken, post.linkedinPostId)

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
