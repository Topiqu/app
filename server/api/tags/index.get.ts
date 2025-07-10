export default defineEventHandler(async () => {
  return await prisma.tag.findMany()
})
