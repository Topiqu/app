import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  const { id } = getRouterParams(event)
  const { pollId, optionId } = await readBody(event)

  if (!pollId || !id || !optionId) {
    throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  }

  const option = await prisma.pollOption.findFirst({
    where: { id: optionId, pollId, poll: { articleId: id } },
    select: { id: true },
  })

  if (!option) {
    throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  }

  const sessionId = user?.id ? null : getCookie(event, 'anon_session') || randomUUID()
  if (!user?.id && sessionId) {
    setCookie(event, 'anon_session', sessionId, { maxAge: 30 * 24 * 60 * 60 })
  }

  try {
    await prisma.pollResult.create({
      data: { articleId: id, pollId, optionId, userId: user?.id || null, sessionId },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
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
