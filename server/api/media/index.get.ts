import { z } from 'zod'
import { MEDIA_ORIGINS } from '~~/shared/types/mediaRights'

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  query: z.string().trim().max(200).optional(),
  origin: z.enum(MEDIA_ORIGINS).optional(),
  usage: z.enum(['all', 'used', 'unused']).default('all'),
  archived: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(false),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireTenantScope(event, 'ARTICLE_WRITE')
  const query = await getValidatedQuery(event, QuerySchema.parse)
  const where = {
    clientSiteId: user.clientSiteId!,
    purgedAt: null,
    archivedAt: query.archived ? { not: null } : null,
    ...(query.origin ? { origin: query.origin } : {}),
    ...(query.query ? { searchText: { contains: query.query.toLocaleLowerCase(), mode: 'insensitive' as const } } : {}),
    ...(query.usage === 'used'
      ? { articleUsages: { some: { deletedAt: null } } }
      : query.usage === 'unused'
        ? { articleUsages: { none: { deletedAt: null } } }
        : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { articleUsages: { where: { deletedAt: null }, select: { articleId: true } } },
    }),
    prisma.mediaAsset.count({ where }),
  ])
  return {
    items: rows.map((asset) =>
      mediaLibraryAsset(asset, new Set(asset.articleUsages.map((usage) => usage.articleId)).size),
    ),
    page: query.page,
    pageSize: query.limit,
    total,
  }
})
