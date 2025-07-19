export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, ClientSiteCreateSchema.parse)

  return await prisma.clientSite.create({
    data: body,
  })
})
