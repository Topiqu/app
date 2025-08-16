import slugify from 'slugify'
import * as cheerio from 'cheerio'

export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'admin') throw createError({ status: 401 })

  const db = await getEnhancedPrisma(user)
  const body = await readBody(event)

  const $ = cheerio.load(body.content)
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

  const contentWithIds = $.html()

  const article = await db.article.create({
    data: {
      title: body.title,
      content: sanitizeHtml(contentWithIds),
      slug: body.slug,
      userId: body.userId,
      clientSiteId: user.clientSiteId,
      createdAt: new Date(),
      imageUrl: body.imageUrl,
    },
  })

  await logAction({
    action: 'ARTICLE_CREATED',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    ip: getRequestIP(event),
    metadata: {
      articleId: article.id,
      title: article.title,
      slug: article.slug,
    },
  })

  return article
})
