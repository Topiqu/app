import type { NotificationType } from '@prisma/client'

import slugify from 'slugify'
import * as cheerio from 'cheerio'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user

  if (!id) throw createError({ statusCode: 400, message: t('common.errors.missing')! })
  if (!user) throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const body = await readValidatedBody(event, ArticleUpdateSchema.parse)
  const isOnlyViews = Object.keys(body).length === 1 && 'views' in body

  if (!isOnlyViews && body.clientSiteId && body.clientSiteId !== user?.clientSiteId)
    throw createError({ statusCode: 403, message: t('common.errors.articleEditForbidden')! })

  const currentDate = new Date()
  const maxDate = new Date(currentDate.getFullYear() + 100, 11, 31, 23, 59)

  if (body.releaseAt) {
    const releaseDate = new Date(body.releaseAt)
    if (isNaN(releaseDate.getTime()) || releaseDate < currentDate || releaseDate > maxDate) {
      throw createError({ statusCode: 400, message: t('common.errors.invalidReleaseDate')! })
    }
  }

  const previousArticle = await db.article.findUnique({
    where: { id },
    select: { status: true, releaseAt: true },
  })

  if (!previousArticle) throw createError({ statusCode: 404, message: t('common.errors.articleNotFound')! })

  if (
    body.releaseAt &&
    (previousArticle.status === 'published' ||
      (previousArticle.releaseAt && new Date(previousArticle.releaseAt) < currentDate))
  ) {
    throw createError({ statusCode: 403, message: t('common.errors.releaseDateLocked')! })
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

  let article
  if (isOnlyViews) {
    article = await prisma.article.update({
      where: { id },
      data: { views: body.views },
    })
  } else {
    const data: any = {
      ...body,
      releaseAt: body.releaseAt ? new Date(body.releaseAt) : undefined,
    }
    if (body.content) data.content = sanitizeHtml(content || '')

    article = await db.article.update({
      where: { id },
      data,
    })

    await logAction({
      action: 'ARTICLE_UPDATE',
      userId: user.id,
      clientSiteId: user.clientSiteId,
      ip: getIp(event),
      metadata: { articleId: id, updatedFields: Object.keys(body) },
    })
  }

  if (!isOnlyViews && article.status === 'published' && previousArticle?.status === 'draft') {
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
