export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = await getSessionUser(event)
  const { id } = getRouterParams(event)
  const { pollId, optionId } = await readBody(event)

  if (typeof pollId !== 'string' || !pollId || !id || typeof optionId !== 'string' || !optionId) {
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  }

  const option = await prisma.pollOption.findFirst({
    where: { id: optionId, pollId, poll: { articleId: id } },
    select: { poll: { select: { article: { select: articleAccessSelect } } } },
  })
  const article = option?.poll.article

  // A reader who cannot see the article learns nothing about it. One who can (an admin previewing
  // a draft or a scheduled article) is told why the poll does not take votes yet.
  if (!article || !canReadArticle(user, article)) {
    throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  }
  if (!isArticleLive(article)) {
    throw createError({ statusCode: 409, message: t('common.errors.pollNotOpen')! })
  }

  const sessionId = user?.id ? null : issueAnonSession(event)

  try {
    await prisma.pollResult.create({
      data: { articleId: id, pollId, optionId, userId: user?.id || null, sessionId },
    })
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw createError({ statusCode: 409, message: t('common.errors.alreadyVoted')! })
    }
    throw e
  }

  const grouped = await prisma.pollResult.groupBy({
    by: ['optionId'],
    where: { pollId },
    _count: { optionId: true },
  })

  const voteCounts = grouped.reduce<Record<string, number>>(
    (acc, g) => ({ ...acc, [g.optionId]: g._count.optionId }),
    {},
  )

  return { pollResult: optionId, voteCounts }
})
