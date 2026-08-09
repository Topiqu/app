import { isManagedDomain } from '~~/shared/utils/domain'
import { publicClientSiteSelect } from '~~/shared/utils/clientSiteFields'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, message: 'Neplatný požadavek' })
  }

  const clientSite = await prisma.clientSite.findFirst({
    where: process.env.NODE_ENV === 'production' ? { domain: slug } : { OR: [{ domain: slug }, { name: slug }] },
    select: publicClientSiteSelect,
  })

  if (!clientSite) {
    throw createError({ statusCode: 404, message: 'Blog nenalezen' })
  }

  if (process.env.NODE_ENV === 'production' && !clientSite.domainVerified && !isManagedDomain(clientSite.domain)) {
    throw createError({ statusCode: 404, message: 'Blog nenalezen' })
  }

  return clientSite
})
