import { z } from 'zod'
import { MEDIA_ORIGINS } from '~~/shared/types/mediaRights'

const InputSchema = z.object({
  origin: z.enum(MEDIA_ORIGINS),
  sourceUrl: z.string().url().max(2048).nullable().optional(),
  author: z.string().max(255).nullable().optional(),
  license: z.string().max(255).nullable().optional(),
  licenseUrl: z.string().url().max(2048).nullable().optional(),
  attribution: z.string().max(1000).nullable().optional(),
  attributionRequired: z.boolean().optional(),
  confirmRights: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing media id' })
  const body = await readValidatedBody(event, InputSchema.parse)
  const current = await prisma.mediaAsset.findFirst({
    where: { id, clientSiteId: user.clientSiteId!, deletedAt: null },
  })
  if (!current) throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  if (body.origin === 'TOPIQU_AI' && current.origin !== 'TOPIQU_AI')
    throw createError({ statusCode: 400, statusMessage: 'System provenance cannot be assigned manually' })

  const materialChanged = ['origin', 'sourceUrl', 'author', 'license', 'licenseUrl'].some(
    (key) =>
      body[key as keyof typeof body] !== undefined &&
      body[key as keyof typeof body] !== current[key as keyof typeof current],
  )
  const data = {
    ...body,
    confirmRights: undefined,
    rightsConfirmedAt:
      body.confirmRights === true
        ? new Date()
        : body.confirmRights === false || materialChanged
          ? null
          : current.rightsConfirmedAt,
    rightsConfirmedById:
      body.confirmRights === true
        ? user.id
        : body.confirmRights === false || materialChanged
          ? null
          : current.rightsConfirmedById,
    attributionRequired:
      body.attributionRequired ?? (body.origin === 'CREATIVE_COMMONS' ? true : current.attributionRequired),
  }
  delete data.confirmRights
  const asset = await prisma.mediaAsset.update({ where: { id }, data })
  await logAction({
    action: 'MEDIA_RIGHTS_UPDATED',
    userId: user.id,
    clientSiteId: user.clientSiteId!,
    ip: getIp(event),
    metadata: { mediaId: id, changedFields: Object.keys(body), previousOrigin: current.origin, origin: asset.origin },
  })
  return { asset }
})
