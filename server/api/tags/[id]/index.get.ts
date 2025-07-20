export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user)
    throw createError({ statusCode: 401, statusMessage: 'Neautorizováno' })

  const id = getRouterParam(event, 'id')
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'ID je povinné' })

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
