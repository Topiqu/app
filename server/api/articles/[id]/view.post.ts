import type { H3Event } from 'h3'

import { randomUUID } from 'node:crypto'

// The visitor identity is server-issued, never read from the body: the whole point of the dedup
// index is that the caller cannot pick which row it collides with.
const readSessionId = (event: H3Event) => {
  const existing = getCookie(event, 'anon_session')
  if (existing) return existing

  // Same name, maxAge and flags as `vote.post.ts` writes — two endpoints setting one cookie with
  // different attributes would flap it on every other request.
  const issued = randomUUID()
  setCookie(event, 'anon_session', issued, { maxAge: 30 * 24 * 60 * 60 })
  return issued
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing article ID' })

  const user = (await getServerSession(event))?.user
  const sessionId = user?.id ?? readSessionId(event)

  // Published only — an admin previewing a draft used to inflate the counter the dashboard
  // then reported as readership.
  const article = await prisma.article.findFirst({
    where: { id, status: 'published' },
    select: { id: true, clientSiteId: true },
  })
  if (!article) return { success: false, counted: false }

  const viewedOn = new Date()
  viewedOn.setUTCHours(0, 0, 0, 0)

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
