import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const { id } = getRouterParams(event)
  const { pollId } = getQuery(event)

  if (!pollId || !id) {
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  }

  const sessionId = user?.id ? null : getCookie(event, 'anon_session') || randomUUID()
  if (!user?.id && sessionId) setCookie(event, 'anon_session', sessionId, { maxAge: 30 * 24 * 60 * 60 })

  const grouped = await prisma.pollResult.groupBy({
    by: ['optionId'],
    where: { pollId: pollId as string },
    _count: { optionId: true },
  })

  const voteCounts = grouped.reduce<Record<string, number>>(
    (acc, g) => ({ ...acc, [g.optionId]: g._count.optionId }),
    {},
  )

  const userVote = await prisma.pollResult.findFirst({
    where: user?.id
      ? { pollId: pollId as string, userId: user.id }
      : { pollId: pollId as string, sessionId, userId: null },
    select: { optionId: true },
  })

  return { pollResult: userVote ? userVote.optionId : null, voteCounts }
})
