import { publicWidgets } from '~~/shared/utils/widgets'
import { publicClientSiteSelect } from '~~/shared/utils/clientSiteFields'

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'id')
  if (!userId) throw createError({ statusCode: 400, message: 'Neplatný požadavek' })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      clientSite: { select: publicClientSiteSelect },
    },
  })

  const site = user?.clientSite
  return site ? { ...site, widgets: publicWidgets(site.widgets, site) } : null
})
