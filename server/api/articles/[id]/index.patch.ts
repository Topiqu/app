import slugify from 'slugify'
import * as cheerio from 'cheerio'
import { ArticleStatus, type NotificationType } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user

  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const body = await readValidatedBody(event, ArticleUpdateSchema.parse)

  if (body.clientSiteId && body.clientSiteId !== user?.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.articleEditForbidden')! })

  if (!isCdnImageUrl(body.imageUrl))
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const currentDate = new Date()
  const maxDate = new Date(currentDate.getFullYear() + 100, 11, 31, 23, 59)

  const previousArticle = await db.article.findUnique({
    where: { id },
    select: { status: true, releaseAt: true, articleSeriesId: true, seriesOrder: true },
  })

  if (!previousArticle) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

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

  let content = body.content
  if (content) {
    const $ = cheerio.load(content)
    const usedIds = new Map()
    $('h1, h2, h3').each((i, el) => {
      const $el = $(el)
      let text = $el.text().trim()
      if (!text) {
        $el.attr('id', `heading-${i}`)
        return
      }
      const maxLength = 50
      text = text.length > maxLength ? text.slice(0, maxLength) : text
      const baseId = slugify(text, { lower: true, strict: true })
      let id = baseId
      let counter = 1
      while (usedIds.has(id)) {
        id = `${baseId}-${counter++}`
      }
      usedIds.set(id, true)
      $el.attr('id', id)
    })
    content = $.html()
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

  if (article.status === ArticleStatus.published) {
    await syncArticleTranslationQueue(db, article.id, user.clientSiteId, { contentChanged: 'content' in data })
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
      select: { followerId: true },
    })

    const notifications = followers.map((follower) => ({
      message: `${user?.name} vydal nový článek: ${article.title}`,
      userId: follower.followerId,
      articleId: article.id,
      type: 'ARTICLE_PUBLISHED' as NotificationType,
    }))

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
