import * as cheerio from 'cheerio'
import slugify from 'slugify'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session || session.user.role !== 'admin')
    throw createError({ status: 401 })

  const body = await readValidatedBody(event, ArticleCreateSchema.parse)
  const $ = cheerio.load(body.content)

  const usedIds = new Map()
  $('h2').each((i, el) => {
    const $el = $(el)
    let text = $el.text().trim()

    if (!text) {
      $el.attr('id', `heading-${i}`)
      return
    }
    const maxLength = 50
    text = text.length > maxLength ? text.slice(0, maxLength) : text

    let baseId = slugify(text, { lower: true, strict: true })
    let id = baseId
    let counter = 1

    while (usedIds.has(id)) {
      id = `${baseId}-${counter++}`
    }
    usedIds.set(id, true)

    $el.attr('id', id)
  })

  const contentWithIds = $.html()

  const article = await prisma.article.create({
    data: {
      title: body.title,
      content: sanitizeHtml(contentWithIds),
      slug: body.slug,
      userId: body.userId,
      createdAt: new Date(),
      imageUrl: body.imageUrl,
    },
  })

  return article
})
