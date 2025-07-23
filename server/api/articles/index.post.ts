import * as cheerio from 'cheerio'
export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!session || session.user.role !== 'admin')
    throw createError({ status: 401 })

  const body = await readValidatedBody(event, ArticleCreateSchema.parse)
  const $ = cheerio.load(body.content)
  $('h2').each((i, el) => {
    const existingId = $(el).attr('id')
    if (!existingId) {
      $(el).attr('id', `heading-${i}`)
    }
  })

  const contentWithIds = $.html()
  console.log(contentWithIds)

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
