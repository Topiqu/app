export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const { id } = getRouterParams(event)
  const { pollId } = getQuery(event)

  if (!pollId || !id) {
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  }

  // Read-only: this route only reports counts, so it must not mint an identity for a crawler.
  // A first-time visitor has no cookie yet and correctly reads back no vote of their own.
  const sessionId = user?.id ? null : readAnonSession(event)

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
