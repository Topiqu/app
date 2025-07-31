import slugify from 'slugify'
import * as cheerio from 'cheerio'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = (await getServerSession(event))?.user

  const db = await getEnhancedPrisma(user)

  if (!user) throw createError({ status: 401 })

  const body = await readValidatedBody(event, ArticleUpdateSchema.parse)
  const $ = cheerio.load(body.content || '')
  if (body.clientSiteId !== user.clientSiteId) throw createError('Tento článek nemůžete upravovat.')
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

  const content = $.html()

  const article = await db.article.update({
    where: { id },
    data: {
      title: body.title,
      content: sanitizeHtml(content),
      slug: body.slug,
      userId: body.userId,
      imageUrl: body.imageUrl,
    },
  })

  return article
})
