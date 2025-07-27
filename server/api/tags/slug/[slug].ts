export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug)
    throw createError({ statusCode: 400, statusMessage: 'Slug je povinný' })

  const user = (await getServerSession(event))?.user

  const tag = await prisma.tag.findFirst({
    where: {
      slug,
    },
    include: {
      articles: {
        where:
          user?.role === 'admin' ? {} : { article: { status: 'published' } },
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
