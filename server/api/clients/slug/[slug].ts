export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Neplatný požadavek' })

  const clientSite = await prisma.clientSite.findFirst({
    where: { name: slug },
    select: { id: true, name: true },
  })

  if (!clientSite) throw createError({ statusCode: 404, message: 'Blog nenalezen' })

  return clientSite
})
