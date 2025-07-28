export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  const slug = getRouterParam(event, 'id')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug je povinný' })

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
  if (!article) throw createError({ statusCode: 404, statusMessage: 'Článek nenalezen' })

  if (article.status !== 'published' && user?.role !== 'admin')
    throw createError({
      statusCode: 403,
      statusMessage: 'Nedostupné',
    })

  return article
})
