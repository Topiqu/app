export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug)
    throw createError({ statusCode: 400, statusMessage: 'Slug je povinný' })

  const tag = await prisma.tag.findUnique({
    where: { slug },
    include: {
      articles: {
        include: {
          article: {
            include: {
              tags: {
                include: {
                  tag: true,
                },
              },
              user: true,
            },
          },
        },
      },
    },
  })

  if (!tag)
    throw createError({ statusCode: 404, statusMessage: 'Tag nenalezen' })

  return tag
})
