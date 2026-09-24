import { z } from 'zod'
import { suggestBrandColors } from '~~/server/utils/brandPalette'

const InputSchema = z.object({ logoUrl: z.string().url().max(255) })
const MAX_LOGO_BYTES = 15 * 1024 * 1024
const RASTER_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing client site' })
  const user = (await getServerSession(event))?.user
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin'))
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'TENANT_SETTINGS', id)
  const { logoUrl } = await readValidatedBody(event, InputSchema.parse)
  const source = new URL(logoUrl)
  const cdn = new URL(useRuntimeConfig().public.cdnUrl)
  if (
    source.protocol !== 'https:' ||
    source.origin !== cdn.origin ||
    source.search ||
    source.hash ||
    !/^\/uploads\/[A-Za-z0-9._/-]+$/.test(source.pathname)
  )
    throw createError({ statusCode: 400, statusMessage: 'Choose an uploaded logo first' })

  const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(8000) })
  if (!response.ok || !RASTER_TYPES.has(response.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase() ?? ''))
    throw createError({ statusCode: 422, statusMessage: 'Logo could not be read' })
  if (Number(response.headers.get('content-length') || 0) > MAX_LOGO_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'Logo is too large' })
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length > MAX_LOGO_BYTES) throw createError({ statusCode: 413, statusMessage: 'Logo is too large' })
  const colors = await suggestBrandColors(bytes)
  return { colors }
})
