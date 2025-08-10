import type { NotificationType } from '@prisma/client'

import slugify from 'slugify'
import * as cheerio from 'cheerio'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user
  if (!id) throw createError({ status: 400, message: 'ID článku je povinné' })
  if (!user) throw createError({ status: 401 })

  const body = await readValidatedBody(event, ArticleUpdateSchema.parse)
  if (body.clientSiteId && body.clientSiteId !== user.clientSiteId)
    throw createError({ status: 403, message: 'Tento článek nemůžete upravovat' })

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

  const previousArticle = await prisma.article.findUnique({
    where: { id },
    select: { status: true },
  })

  const article = await prisma.article.update({
    where: { id },
    data: {
      title: body.title,
      content: content ? sanitizeHtml(content) : undefined,
      slug: body.slug,
      userId: body.userId,
      imageUrl: body.imageUrl,
      status: body.status,
      views: body.views,
      allowedComments: body.allowedComments,
    },
  })

  if (article.status === 'published' && previousArticle?.status === 'draft') {
    const followers = await prisma.follow.findMany({
      where: { followedId: article.userId },
      select: { followerId: true },
    })

    const notifications = followers.map((follower) => ({
      message: `${user.name} vydal nový článek: ${article.title}`,
      userId: follower.followerId,
      articleId: article.id,
      type: 'ARTICLE_PUBLISHED' as NotificationType,
    }))

    await prisma.$transaction(async (tx) => {
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

  return article
})
