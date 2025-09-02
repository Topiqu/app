import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const { id } = getRouterParams(event)
  const { pollId, response } = await readBody(event)

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

  let pollResult = null
  if (response) {
    const existingVote = await prisma.pollResult.findFirst({
      where: {
        pollId,
        OR: [
          { userId: user?.id, sessionId: null },
          { userId: null, sessionId },
        ],
      },
    })

    if (existingVote) {
      throw createError({ statusCode: 409, statusMessage: 'Už jste hlasovali v této anketě' })
    }

    pollResult = await prisma.pollResult.create({
      data: { articleId: id, pollId, userId: user?.id, sessionId, response },
    })
  }

  const results = await prisma.pollResult.findMany({
    where: { pollId },
    select: { id: true, response: true, userId: true, sessionId: true },
  })

  const voteCounts = results.reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.response]: (acc[r.response] || 0) + 1 }),
    {},
  )

  const userVote = results.find((r) =>
    user?.id ? r.userId === user.id && r.sessionId === null : r.sessionId === sessionId && r.userId === null,
  )

  return { pollResult: userVote || pollResult, voteCounts }
})
