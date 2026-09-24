import { DbNull } from '@zenstackhq/orm'
import { ArticleUpdateSchema } from '~~/shared/databaseSchemas'
import { ArticleStatus, type NotificationType } from '~~/generated/zenstack/models'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  const { user, membership } = await requireTenantScope(event, 'ARTICLE_WRITE')

  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })

  const db = await getEnhancedPrisma(user)
  const rawBody = await readBody(event)
  const mediaRightsReview = rawBody.mediaRightsReview
  delete rawBody.mediaRightsReview
  if (rawBody.imageCredit === null) rawBody.imageCredit = DbNull
  const body = ArticleUpdateSchema.parse(rawBody)

  if (body.clientSiteId && body.clientSiteId !== user?.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.articleEditForbidden')! })

  if (!isCdnImageUrl(body.imageUrl)) throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })
  if (body.coverMediaId !== undefined) await assertTenantMedia(user.clientSiteId!, body.coverMediaId)

  const currentDate = new Date()
  const maxDate = new Date(currentDate.getFullYear() + 100, 11, 31, 23, 59)

  const previousArticle = await db.article.findUnique({
    where: { id },
    select: {
      status: true,
      releaseAt: true,
      articleSeriesId: true,
      seriesOrder: true,
      userId: true,
      imageUrl: true,
      coverMediaId: true,
      content: true,
    },
  })

  if (!previousArticle) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })
  if (previousArticle.userId !== user.id && !hasTenantScope(membership, 'ARTICLE_WRITE_OTHERS'))
    throw createError({ statusCode: 403, message: t('common.errors.articleEditForbidden')! })
  if ((body.status === ArticleStatus.published || body.releaseAt) && !hasTenantScope(membership, 'ARTICLE_PUBLISH'))
    throw createError({ statusCode: 403, message: 'Missing tenant scope: ARTICLE_PUBLISH' })

  const requiresPublicationReview =
    body.status === ArticleStatus.published ||
    Boolean(body.releaseAt) ||
    previousArticle.status === ArticleStatus.published
  const mediaReport = requiresPublicationReview
    ? await requireMediaRightsReview(
        prisma,
        user.clientSiteId!,
        {
          imageUrl: body.imageUrl === undefined ? previousArticle.imageUrl : body.imageUrl,
          coverMediaId: body.coverMediaId === undefined ? previousArticle.coverMediaId : body.coverMediaId,
          content: body.content === undefined ? previousArticle.content : body.content,
        },
        mediaRightsReview,
      )
    : null

  if (previousArticle.status === ArticleStatus.published) {
    delete body.releaseAt
  }

  if (body.releaseAt) {
    const releaseDate = new Date(body.releaseAt)
    const isUnchanged =
      previousArticle.releaseAt && new Date(previousArticle.releaseAt).getTime() === releaseDate.getTime()

    if (!isUnchanged && (isNaN(releaseDate.getTime()) || releaseDate < currentDate || releaseDate > maxDate)) {
      throw createError({ statusCode: 400, message: t('common.errors.invalidReleaseDate')! })
    }
  }

  if (body.releaseAt && new Date(body.releaseAt).getTime() > currentDate.getTime()) body.status = ArticleStatus.draft
  else if (body.status === ArticleStatus.published) body.releaseAt = null

  let newSeriesOrder = previousArticle.seriesOrder
  if (body.articleSeriesId !== undefined) {
    if (body.articleSeriesId === null) {
      newSeriesOrder = 0
    } else if (body.articleSeriesId !== previousArticle.articleSeriesId) {
      const lastArticle = await db.article.findFirst({
        where: {
          articleSeriesId: body.articleSeriesId,
          clientSiteId: user.clientSiteId,
        },
        orderBy: { seriesOrder: 'desc' },
        select: { seriesOrder: true },
      })
      newSeriesOrder = (lastArticle?.seriesOrder ?? 0) + 1
    }
  }

  const attributedContent = body.content ? await applyMediaAttributions(user.clientSiteId!, body.content) : body.content
  const content = attributedContent ? stampHeadingIds(attributedContent) : attributedContent
  if (body.coverMediaId !== undefined) {
    const mediaCoverCredit = await coverCreditFromMedia(user.clientSiteId!, body.coverMediaId)
    if (mediaCoverCredit) body.imageCredit = JSON.parse(JSON.stringify(mediaCoverCredit))
  }

  const data: any = {
    ...body,
    seriesOrder: newSeriesOrder,
  }
  if ('releaseAt' in body) {
    data.releaseAt = body.releaseAt ? new Date(body.releaseAt) : null
  }
  if (body.content) data.content = sanitizeHtml(content || '')

  const article = await db.article.update({
    where: { id },
    data,
  })

  if ('content' in data) {
    const contentWithPolls = await syncArticlePolls(
      db as unknown as Parameters<typeof syncArticlePolls>[0],
      article.id,
      data.content,
    )
    if (contentWithPolls !== data.content) {
      await db.article.update({ where: { id: article.id }, data: { content: sanitizeHtml(contentWithPolls) } })
    }
  }

  const usageArticle = await prisma.article.findFirst({
    where: { id: article.id, clientSiteId: user.clientSiteId! },
    select: { imageUrl: true, coverMediaId: true, content: true, clientSite: { select: { language: true } } },
  })
  if (usageArticle)
    await syncArticleMediaUsages(prisma, {
      clientSiteId: user.clientSiteId!,
      articleId: article.id,
      language: usageArticle.clientSite.language,
      imageUrl: usageArticle.imageUrl,
      coverMediaId: usageArticle.coverMediaId,
      content: usageArticle.content,
    })

  if (article.status === ArticleStatus.published) {
    await syncArticleTranslationQueue(db, article.id, user.clientSiteId, { contentChanged: 'content' in data })
  }

  if (mediaReport) {
    const site = await prisma.clientSite.findUnique({ where: { id: user.clientSiteId! }, select: { language: true } })
    await createMediaRightsSnapshot(prisma, {
      articleId: article.id,
      clientSiteId: user.clientSiteId!,
      language: site?.language ?? 'en',
      report: mediaReport,
      confirmedById: user.id,
    })
  }

  // Covers publishing, unpublishing and edits to an already-live article. A
  // draft-only edit is not in any listing, so it must not flush the tenant's cache.
  if (article.status === ArticleStatus.published || previousArticle.status === ArticleStatus.published) {
    await invalidateFeed(user.clientSiteId)
  }

  await logAction({
    action: 'ARTICLE_UPDATE',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    ip: getIp(event),
    metadata: { articleId: id, updatedFields: Object.keys(body) },
  })

  if (article.status === ArticleStatus.published && previousArticle?.status === ArticleStatus.draft) {
    const followers = await db.follow.findMany({
      where: { followedId: article.userId, follower: { allowNotifs: true } },
      select: { followerId: true, follower: { select: { language: true } } },
    })

    const author = user?.name ?? 'Anonymous'
    const notifications = await Promise.all(
      followers.map(async (follower) => {
        const translate = await getServerTranslator(follower.follower.language || 'en')
        return {
          message: translate('common.notifications.newArticleFromFollowed', [author, article.title])!,
          userId: follower.followerId,
          articleId: article.id,
          type: 'ARTICLE_PUBLISHED' as NotificationType,
        }
      }),
    )

    if (notifications.length > 0) {
      await db.$transaction(async (tx) => {
        const BATCH_SIZE = 100
        for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
          await tx.notification.createMany({
            data: notifications.slice(i, i + BATCH_SIZE),
            skipDuplicates: true,
          })
        }
      })
    }
  }

  return { success: true }
})
