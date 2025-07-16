export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'id')
  if (!slug)
    throw createError({ statusCode: 400, statusMessage: 'Slug je povinný' })

  const article = await prisma.article.findUnique({
    where: { slug },
    include: {
      user: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
  })

  if (!article)
    throw createError({ statusCode: 404, statusMessage: 'Článek nenalezen' })

  return article
})
