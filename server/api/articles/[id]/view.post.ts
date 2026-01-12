export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing article ID' })
  }

  try {
    await prisma.article.update({
      where: { id },
      data: {
        views: {
          increment: 1,
        },
      },
      select: { id: true },
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to increment view:', error)
    return { success: false }
  }
})
