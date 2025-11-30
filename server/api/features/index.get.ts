export default defineEventHandler(async () => {
  return await prisma.feature.findMany({})
})
