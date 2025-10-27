export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Neplatný požadavek' })
  console.log(slug)
  // const clientSite = await prisma.clientSite.findFirst({
  //   where: { name: slug },
  // })
  const clientSite = await prisma.clientSite.findFirst({
    where: { subdomain: slug },
  }) // FOR PRODUCTION

  if (!clientSite) throw createError({ statusCode: 404, message: 'Blog nenalezen' })

  return clientSite
})
