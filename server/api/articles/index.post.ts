import slugify from 'slugify'
import * as cheerio from 'cheerio'

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const user = (await getServerSession(event))?.user
  if (!user || user.role !== 'admin') throw createError({ statusCode: 401, message: t('common.errors.unauthorized')! })

  const db = await getEnhancedPrisma(user)
  const body = await readBody(event)

  let seriesOrder = 0
  if (body.articleSeriesId) {
    const lastArticle = await db.article.findFirst({
      where: { articleSeriesId: body.articleSeriesId, clientSiteId: user.clientSiteId },
      orderBy: { seriesOrder: 'desc' },
      select: { seriesOrder: true },
    })
    seriesOrder = (lastArticle?.seriesOrder ?? 0) + 1
  }

  const $ = cheerio.load(body.content || '')
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

  const tagsRelation =
    body.tags && Array.isArray(body.tags) && body.tags.length > 0
      ? { create: body.tags.map((tagId: string) => ({ tag: { connect: { id: tagId } } })) }
      : undefined

  const article = await db.article.create({
    data: {
      ...body,
      seriesOrder,
      content: sanitizeHtml(contentWithIds),
      clientSiteId: user.clientSiteId,
      userId: user.id,
      tags: tagsRelation,
    },
  })

  await logAction({
    action: 'ARTICLE_CREATED',
    userId: user.id,
    clientSiteId: user.clientSiteId,
    ip: getIp(event),
    metadata: { articleId: article.id, title: article.title },
  })

  return article
})
