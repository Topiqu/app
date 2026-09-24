import { DbNull } from '@zenstackhq/orm'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')

  const db = await getEnhancedPrisma(user)
  const body = await readBody(event)
  const mediaRightsReview = body.mediaRightsReview
  delete body.mediaRightsReview
  if (
    (body.status === 'published' || body.releaseAt) &&
    !hasTenantScope((await requireTenantMember(event)).membership, 'ARTICLE_PUBLISH')
  )
    throw createError({ statusCode: 403, message: 'Missing tenant scope: ARTICLE_PUBLISH' })

  if (body.releaseAt && new Date(body.releaseAt).getTime() > Date.now()) body.status = 'draft'
  else if (body.status === 'published') body.releaseAt = null

  if (!isCdnImageUrl(body.imageUrl)) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  await assertTenantMedia(user.clientSiteId!, body.coverMediaId)

  const requiresPublicationReview = body.status === 'published' || Boolean(body.releaseAt)
  const mediaReport = requiresPublicationReview
    ? await requireMediaRightsReview(
        prisma,
        user.clientSiteId!,
        { imageUrl: body.imageUrl, coverMediaId: body.coverMediaId, content: body.content },
        mediaRightsReview,
      )
    : null

  let seriesOrder = 0
  if (body.articleSeriesId) {
    const lastArticle = await db.article.findFirst({
      where: { articleSeriesId: body.articleSeriesId, clientSiteId: user.clientSiteId },
      orderBy: { seriesOrder: 'desc' },
      select: { seriesOrder: true },
    })
    seriesOrder = (lastArticle?.seriesOrder ?? 0) + 1
  }

  const contentWithIds = stampHeadingIds(await applyMediaAttributions(user.clientSiteId!, body.content))
  const mediaCoverCredit = await coverCreditFromMedia(user.clientSiteId!, body.coverMediaId)
  if (mediaCoverCredit) body.imageCredit = JSON.parse(JSON.stringify(mediaCoverCredit))

  // A full manual generation is written by the configured AI author just like a scheduled one.
  // The signed-in member remains the actor in the audit log; `userId` here is public authorship.
  const aiAuthor =
    body.aiInvolvement === 'FULL'
      ? await db.user.findFirst({
          where: { clientSiteId: user.clientSiteId, role: 'ai' },
          select: { id: true },
        })
      : null

  const tagsRelation =
    body.tags && Array.isArray(body.tags) && body.tags.length > 0
      ? { create: body.tags.map((tagId: string) => ({ tag: { connect: { id: tagId } } })) }
      : undefined

  const article = await db.article.create({
    data: {
      slug: body.slug,
      title: body.title,
      excerpt: body.excerpt,
      content: sanitizeHtml(contentWithIds),
      imageUrl: body.imageUrl,
      imageCredit: body.imageCredit === null ? DbNull : body.imageCredit,
      status: body.status,
      aiInvolvement: body.aiInvolvement,
      readingTime: body.readingTime,
      totalWords: body.totalWords,
      savedAmount: body.savedAmount,
      savedTimeMinutes: body.savedTimeMinutes,
      releaseAt: body.releaseAt,
      allowedComments: body.allowedComments,
      sources: body.sources,
      answer: body.answer,
      keyTakeaways: body.keyTakeaways,
      faq: body.faq,
      format: body.format,
      structureVariant: body.structureVariant,
      prompt: body.prompt,
      seriesOrder,
      clientSiteId: user.clientSiteId,
      userId: aiAuthor?.id ?? user.id,
      coverMediaId: body.coverMediaId,
      articleSeriesId: body.articleSeriesId,
      tags: tagsRelation,
    },
  })

  const contentWithPolls = await syncArticlePolls(
    db as unknown as Parameters<typeof syncArticlePolls>[0],
    article.id,
    article.content,
  )
  if (contentWithPolls !== article.content) {
    await db.article.update({ where: { id: article.id }, data: { content: sanitizeHtml(contentWithPolls) } })
  }

  const site = await prisma.clientSite.findUnique({ where: { id: user.clientSiteId! }, select: { language: true } })
  await syncArticleMediaUsages(prisma, {
    clientSiteId: user.clientSiteId!,
    articleId: article.id,
    language: site?.language ?? 'en',
    imageUrl: article.imageUrl,
    coverMediaId: article.coverMediaId,
    content: contentWithPolls,
  })

  if (article.status === 'published') {
    await syncArticleTranslationQueue(db, article.id, user.clientSiteId)
    await invalidateFeed(user.clientSiteId)
  }

  if (mediaReport) {
    await createMediaRightsSnapshot(prisma, {
      articleId: article.id,
      clientSiteId: user.clientSiteId!,
      language: site?.language ?? 'en',
      report: mediaReport,
      confirmedById: user.id,
    })
  }

  await logAction({
    action: 'ARTICLE_CREATED',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    ip: getIp(event),
    metadata: { articleId: article.id, title: article.title },
  })

  return article
})
