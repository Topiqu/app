import { hostedFontUrl } from '~~/shared/utils/publicationBranding'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const slot = getRouterParam(event, 'slot')
  if (!id || (slot !== 'heading' && slot !== 'body'))
    throw createError({ statusCode: 400, statusMessage: 'Invalid font slot' })
  const user = (await getServerSession(event))?.user
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin'))
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'TENANT_SETTINGS', id)
  const site = await prisma.clientSite.findUnique({
    where: { id },
    select: { headingFontUrl: true, bodyFontUrl: true },
  })
  if (!site) throw createError({ statusCode: 404, statusMessage: 'Client site not found' })
  await prisma.clientSite.update({
    where: { id },
    data: slot === 'heading' ? { headingFontUrl: null } : { bodyFontUrl: null },
  })
  const oldUrl = hostedFontUrl(
    slot === 'heading' ? site.headingFontUrl : site.bodyFontUrl,
    useRuntimeConfig().public.cdnUrl,
    id,
  )
  if (oldUrl) {
    try {
      await deleteFromCdn(new URL(oldUrl).pathname.slice(1), `fonts/${id}/`)
    } catch (error) {
      await reportCaughtError('Custom font deletion failed', error, { clientSiteId: id, slot })
    }
  }
  return { ok: true }
})
