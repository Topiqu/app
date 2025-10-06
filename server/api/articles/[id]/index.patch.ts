import type { NotificationType } from '@prisma/client'

import slugify from 'slugify'
import * as cheerio from 'cheerio'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user
  if (!id) throw createError({ status: 400, message: 'ID článku je povinné' })
  if (!user) throw createError({ status: 401 })

  const db = await getEnhancedPrisma(user)
  const body = await readValidatedBody(event, ArticleUpdateSchema.parse)
  const isOnlyViews = Object.keys(body).length === 1 && 'views' in body

  if (!isOnlyViews && body.clientSiteId && body.clientSiteId !== user?.clientSiteId)
    throw createError({ status: 403, message: 'Tento článek nemůžete upravovat' })

  const currentDate = new Date()
  const maxDate = new Date(currentDate.getFullYear() + 100, 11, 31, 23, 59)

  if (body.releaseAt) {
    const releaseDate = new Date(body.releaseAt)
    if (isNaN(releaseDate.getTime()) || releaseDate < currentDate || releaseDate > maxDate) {
      throw createError({
        status: 400,
        message: `Datum vydání musí být od teď (${currentDate.toISOString()}) do ${currentDate.getFullYear() + 100}`,
      })
    }
  }

  const previousArticle = await db.article.findUnique({
    where: { id },
    select: { status: true, releaseAt: true },
  })

  if (!previousArticle) throw createError({ status: 404, message: 'Článek nenalezen' })

  if (
    body.releaseAt &&
    (previousArticle.status === 'published' ||
      (previousArticle.releaseAt && new Date(previousArticle.releaseAt) < currentDate))
  ) {
    throw createError({
      status: 403,
      message: 'Nelze upravit datum vydání u publikovaného článku nebo článku s uplynulým datem vydání',
    })
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
    const data = {
      content: sanitizeHtml(content || ''),
      releaseAt: body.releaseAt ? new Date(body.releaseAt) : undefined,
      ...body,
    }
    article = await db.article.update({
      where: { id },
      data,
    })
  }

  if (!isOnlyViews && article.status === 'published' && previousArticle?.status === 'draft') {
    const followers = await db.follow.findMany({
      where: {
        followedId: article.userId,
        follower: { allowNotifs: true },
      },
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
          const batch = notifications.slice(i, i + BATCH_SIZE)
          await tx.notification.createMany({
            data: batch,
            skipDuplicates: true,
          })
        }
      })
    }
  }

  return { success: true }
})
