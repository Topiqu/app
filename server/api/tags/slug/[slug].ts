export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug)
    throw createError({ statusCode: 400, statusMessage: 'Slug je povinný' })

  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const tag = await prisma.tag.findFirst({
    where: { slug, clientSiteId: user.clientSiteId },
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
