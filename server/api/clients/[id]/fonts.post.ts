import { randomUUID } from 'node:crypto'
import { hasAdvancedBranding, hostedFontUrl } from '~~/shared/utils/publicationBranding'

const MAX_FONT_BYTES = 2 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing client site' })
  const user = (await getServerSession(event))?.user
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin'))
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'TENANT_SETTINGS', id)
  const site = await prisma.clientSite.findUnique({
    where: { id },
    select: { plan: true, headingFontUrl: true, bodyFontUrl: true },
  })
  if (!site) throw createError({ statusCode: 404, statusMessage: 'Client site not found' })
  if (!hasAdvancedBranding(site.plan))
    throw createError({ statusCode: 403, statusMessage: 'Custom fonts require Pro or higher' })

  const parts = await readMultipartFormData(event)
  const slot = parts?.find((part) => part.name === 'slot')?.data.toString()
  const file = parts?.find((part) => part.name === 'file' && part.filename)
  if (slot !== 'heading' && slot !== 'body') throw createError({ statusCode: 400, statusMessage: 'Invalid font slot' })
  if (
    !file ||
    !file.filename?.toLowerCase().endsWith('.woff2') ||
    file.data.length > MAX_FONT_BYTES ||
    file.data.length < 48
  )
    throw createError({ statusCode: 400, statusMessage: 'Choose a WOFF2 file under 2 MB' })
  const header = Buffer.from(file.data)
  if (
    header.toString('ascii', 0, 4) !== 'wOF2' ||
    header.readUInt32BE(8) !== file.data.length ||
    header.readUInt16BE(14) !== 0 ||
    header.readUInt16BE(12) === 0
  )
    throw createError({ statusCode: 400, statusMessage: 'Invalid WOFF2 font' })

  const key = `fonts/${id}/${randomUUID()}.woff2`
  const url = await putToCdn(key, file.data, 'font/woff2', undefined, {
    cacheControl: 'public, max-age=31536000, immutable',
  })
  try {
    await prisma.clientSite.update({
      where: { id },
      data: slot === 'heading' ? { headingFontUrl: url } : { bodyFontUrl: url },
    })
  } catch (error) {
    await deleteFromCdn(key, `fonts/${id}/`)
    throw error
  }
  const oldUrl = hostedFontUrl(
    slot === 'heading' ? site.headingFontUrl : site.bodyFontUrl,
    useRuntimeConfig().public.cdnUrl,
    id,
  )
  if (oldUrl) {
    try {
      await deleteFromCdn(new URL(oldUrl).pathname.slice(1), `fonts/${id}/`)
    } catch (error) {
      await reportCaughtError('Replaced custom font deletion failed', error, { clientSiteId: id, slot })
    }
  }
  return { url, slot }
})
