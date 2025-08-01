import { randomUUID } from 'crypto'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID článku je povinné' })

  const sessionId = getCookie(event, 'anon_session') || randomUUID()
  setCookie(event, 'anon_session', sessionId, { maxAge: 30 * 24 * 60 * 60 })

  const db = await getEnhancedPrisma(user)

  const where = user?.id
    ? { articleId: id, userId: user.id, sessionId: null }
    : { articleId: id, userId: null, sessionId }

  const exists = await db.articleReaction.findFirst({ where })

  if (exists) {
    await db.articleReaction.deleteMany({ where })
    const count = await db.articleReaction.count({ where: { articleId: id } })
    return { liked: false, likes: count }
  }

  await db.articleReaction.create({
    data: { articleId: id, userId: user?.id || null, sessionId: user?.id ? null : sessionId },
  })

  const count = await db.articleReaction.count({ where: { articleId: id } })
  return { liked: true, likes: count }
})
