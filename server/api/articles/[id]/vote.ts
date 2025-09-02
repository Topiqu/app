import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const { id } = getRouterParams(event)
  const { pollId } = getQuery(event)

  if (!pollId || !id) {
    throw createError({ statusCode: 400, statusMessage: 'Něco chybí' })
  }

  const article = await prisma.article.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Článek neexistuje' })
  }

  const sessionId = user?.id ? null : getCookie(event, 'anon_session') || randomUUID()
  if (!user?.id) {
    setCookie(event, 'anon_session', sessionId, { maxAge: 30 * 24 * 60 * 60 })
  }

  const results = await prisma.pollResult.findMany({
    where: { pollId: pollId as string },
    select: { id: true, response: true, userId: true, sessionId: true },
  })

  const voteCounts = results.reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.response]: (acc[r.response] || 0) + 1 }),
    {},
  )

  const userVote = results.find((r) =>
    user?.id ? r.userId === user.id && r.sessionId === null : r.sessionId === sessionId && r.userId === null,
  )

  return { pollResult: userVote, voteCounts }
})
