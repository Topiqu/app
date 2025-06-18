export default defineEventHandler(async () => {
  const articles = await prisma.article.findMany()
  return articles
})
