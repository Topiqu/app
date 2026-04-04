export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, message: 'Neplatný požadavek' })
  }

  const clientSite = await prisma.clientSite.findFirst({
    where: process.env.NODE_ENV === 'production' ? { subdomain: slug } : { name: slug },
  })

  if (!clientSite) {
    throw createError({ statusCode: 404, message: 'Blog nenalezen' })
  }

  return clientSite
})
