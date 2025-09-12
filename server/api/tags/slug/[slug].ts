export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')?.toLowerCase()
  if (!slug) throw createError({ statusCode: 400, message: 'Slug je povinný' })

  const tag = await prisma.tag.findFirst({
    where: { slug },
    include: {
      articles: {
        include: {
          article: {
            include: {
              tags: { include: { tag: true } },
              user: { omit: { password: true } },
              _count: { select: { reactions: true } },
            },
          },
        },
      },
    },
  })

  if (!tag) throw createError({ statusCode: 404, message: 'Tag nenalezen' })

  return {
    ...tag,
    articles: tag.articles.map((a) => ({
      ...a,
      article: {
        ...a.article,
        likes: a.article._count.reactions,
      },
    })),
  }
})
