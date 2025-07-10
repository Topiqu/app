export default defineEventHandler(async (event) => {
  const { id: articleId, tagId } = event.context.params!

  await prisma.articleTag.delete({
    where: {
      articleId_tagId: {
        articleId,
        tagId,
      },
    },
  })

  return { success: true }
})
