import { z } from 'zod'
const BodySchema = z.object({
  platform: z.enum(['TWITTER', 'FACEBOOK', 'LINKEDIN', 'EMAIL', 'OTHER']),
  visitorId: z.string().max(128).nullish(),
})

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const { platform, visitorId } = await readValidatedBody(event, BodySchema.parse)
  const user = (await getServerSession(event))?.user

  if (!user?.id && !visitorId) throw createError({ statusCode: 400, message: 'Missing visitor identification' })

  const article = await prisma.article.findUnique({
    where: { id, status: 'published' },
    select: { id: true, shared: true },
  })
  if (!article) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  // One share per identity per platform, the same gate ArticleReaction applies to likes.
  // Sharing the same article to two networks still counts twice; clicking copy-link twenty
  // times does not.
  const identity = user?.id ? { userId: user.id, sessionId: null } : { userId: null, sessionId: visitorId! }
  const existing = await prisma.articleShare.findFirst({ where: { articleId: id, platform, ...identity } })
  if (existing) return { success: true, shared: article.shared, counted: false }

  try {
    const [updated] = await prisma.$transaction([
      prisma.article.update({
        where: { id },
        data: { shared: { increment: 1 } },
        select: { shared: true },
      }),
      prisma.articleShare.create({ data: { articleId: id, platform, ...identity } }),
    ])

    return { success: true, shared: updated.shared, counted: true }
  } catch (e) {
    // A concurrent request for the same identity already banked the count.
    if ((e as { code?: string }).code !== 'P2002') throw e
    const fresh = await prisma.article.findUnique({ where: { id }, select: { shared: true } })

    return { success: true, shared: fresh?.shared ?? article.shared, counted: false }
  }
})
