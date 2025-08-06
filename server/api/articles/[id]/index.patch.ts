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

  const db = await getEnhancedPrisma(user)

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

  const article = await db.article.update({
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

  return article
})
