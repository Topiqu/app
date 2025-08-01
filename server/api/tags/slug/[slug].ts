export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug je povinný' })

  const user = (await getServerSession(event))?.user

  const tag = await prisma.tag.findFirst({
    where: { slug },
    include: {
      articles: {
        where: user?.role === 'admin' ? {} : { article: { status: 'published' } },
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
