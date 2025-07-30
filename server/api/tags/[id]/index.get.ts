export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID je povinné' })

  const tag = await prisma.tag.findUnique({
    where: { id },
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
              user: { omit: { password: true } },
            },
          },
        },
      },
    },
  })

  if (!tag) throw createError({ statusCode: 404, message: 'Tag nenalezen' })

  return tag
})
