import { WebsiteResultSchema } from '~~/shared/utils/websiteImport'
import { readWebsiteAsset } from '~~/server/utils/websiteImport/assets'

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'TENANT_SETTINGS')
  if (!user.clientSiteId) throw createError({ statusCode: 403 })
  const field = getRouterParam(event, 'field')
  if (field !== 'logoUrl' && field !== 'faviconUrl') throw createError({ statusCode: 400 })
  if (!(await consumeRateLimit(`website-preview:${user.id}`, 30, 60))) throw createError({ statusCode: 429 })
  const db = await getEnhancedPrisma(user)
  const job = await db.websiteImport.findFirst({
    where: { id: getRouterParam(event, 'id') ?? '', clientSiteId: user.clientSiteId, deletedAt: null },
    select: { result: true },
  })
  const parsed = WebsiteResultSchema.safeParse(job?.result)
  const url = parsed.success ? parsed.data.values[field] : null
  if (!url) throw createError({ statusCode: 404 })
  try {
    const asset = await readWebsiteAsset(url, field)
    setHeader(event, 'Content-Type', asset.mimeType)
    setHeader(event, 'Cache-Control', 'private, max-age=60')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    return asset.bytes
  } catch {
    throw createError({ statusCode: 422, data: { code: 'WEBSITE_ASSET' } })
  }
})
