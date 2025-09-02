import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const { id } = getRouterParams(event)
  const { pollId, response } = await readBody(event)

  if (!pollId || !id || !response) {
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
  if (!user?.id && sessionId) {
    setCookie(event, 'anon_session', sessionId, { maxAge: 30 * 24 * 60 * 60 })
  }

  const where = user?.id ? { pollId, userId: user.id, sessionId: null } : { pollId, userId: null, sessionId }

  const existingVote = await prisma.pollResult.findFirst({ where })

  if (existingVote) {
    throw createError({ statusCode: 409, statusMessage: 'Už jste hlasovali v této anketě' })
  }

  const pollResult = await prisma.pollResult.create({
    data: { articleId: id, pollId, userId: user?.id || null, sessionId, response },
  })

  const results = await prisma.pollResult.findMany({
    where: { pollId },
    select: { id: true, response: true, userId: true, sessionId: true },
  })

  const voteCounts = results.reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.response]: (acc[r.response] || 0) + 1 }),
    {},
  )

  console.log('Vote recorded:', { pollId, response, userId: user?.id, sessionId, voteCounts })

  return { pollResult: pollResult.response, voteCounts }
})
