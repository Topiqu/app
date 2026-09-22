import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { aiReferrer } from '~~/shared/utils/aiVisibility'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing article ID' })

  const user = (await getServerSession(event))?.user
  const sessionId = user?.id ?? issueAnonSession(event)
  const parsed = z
    .object({ referrer: z.string().max(2048).optional() })
    .safeParse(await readBody(event).catch(() => ({})))
  const referrer = aiReferrer(parsed.success ? parsed.data.referrer : undefined)

  // Published only — an admin previewing a draft used to inflate the counter the dashboard
  // then reported as readership.
  const article = await prisma.article.findFirst({
    where: { id, status: 'published' },
    select: { id: true, clientSiteId: true },
  })
  if (!article) return { success: false, counted: false }

  const viewedOn = new Date()
  viewedOn.setUTCHours(0, 0, 0, 0)

  if (referrer) {
    try {
      await prisma.aiReferralVisit.upsert({
        where: {
          articleId_sessionId_visitedOn_channel: {
            articleId: article.id,
            sessionId,
            visitedOn: viewedOn,
            channel: referrer.channel,
          },
        },
        create: {
          articleId: article.id,
          clientSiteId: article.clientSiteId,
          sessionId,
          visitedOn: viewedOn,
          channel: referrer.channel,
          referrerHost: referrer.host,
        },
        update: { referrerHost: referrer.host },
      })
    } catch (error) {
      await logger.error('ai referral persistence failed', {
        source: 'ai-visibility',
        clientSiteId: article.clientSiteId,
        articleId: article.id,
        channel: referrer.channel,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    // The counter moves only when the event is new, so both numbers tell the same story. The
    // unique index is the gate, not a pre-read: two concurrent requests would both pass a check.
    const inserted = await prisma.$executeRaw`
      INSERT INTO "ArticleView" ("id", "createdAt", "articleId", "clientSiteId", "userId", "sessionId", "viewedOn")
      VALUES (${randomUUID()}, NOW(), ${article.id}, ${article.clientSiteId}, ${user?.id ?? null}, ${sessionId}, ${viewedOn}::date)
      ON CONFLICT ("articleId", "sessionId", "viewedOn") DO NOTHING
    `

    if (!inserted) return { success: true, counted: false }

    await prisma.article.update({ where: { id }, data: { views: { increment: 1 } }, select: { id: true } })
    return { success: true, counted: true }
  } catch (error) {
    console.error('Failed to record view:', error)
    return { success: false, counted: false }
  }
})
