import { z } from 'zod'
import { DraftStatus } from '~~/generated/zenstack/models'

const querySchema = z.object({
  status: z.enum(DraftStatus).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default defineEventHandler(async (event) => {
  const { user, membership } = await requireTenantScope(event, 'INTEGRATION_CONTROL')
  const { translate: t } = await useServerI18n(event)
  if (!membership.clientSiteId) throw createError({ statusCode: 403, message: t('common.errors.forbidden')! })
  const query = await getValidatedQuery(event, querySchema.parse)
  const db = await getEnhancedPrisma(user)
  const where = {
    deletedAt: null,
    task: { deletedAt: null, company: { clientSiteId: membership.clientSiteId, deletedAt: null } },
    ...(query.status ? { status: query.status } : {}),
  }
  const [rows, total] = await Promise.all([
    db.draftPost.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        text: true,
        score: true,
        status: true,
        policyFlags: true,
        publicationAttemptedAt: true,
        publicationUrn: true,
        publicationError: true,
        task: { select: { topic: true, company: { select: { name: true } } } },
      },
    }),
    db.draftPost.count({ where }),
  ])
  const drafts = rows.map((row) => ({
    ...row,
    policyFlags: Array.isArray(row.policyFlags)
      ? row.policyFlags.filter((flag): flag is string => typeof flag === 'string')
      : [],
  }))
  return { drafts, total, page: query.page, pageSize: query.limit }
})
