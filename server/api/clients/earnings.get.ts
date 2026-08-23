import { z } from 'zod'
import { summarizeEarnings } from '~~/server/utils/adRevenue'

const MAX_RANGE_MONTHS = 24
const DEFAULT_RANGE_MONTHS = 12

const QuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  clientSiteId: z.string().min(1).optional(),
})

const shiftMonths = (date: Date, months: number): Date => {
  const shifted = new Date(date)
  shifted.setUTCMonth(shifted.getUTCMonth() + months)
  return shifted
}

export default defineEventHandler(async (event) => {
  const { translate: t } = await useServerI18n(event)
  const { user, db } = await requireDb(event, { minRole: 'admin' })
  if (user.role !== 'superadmin') await requireTenantScope(event, 'ANALYTICS_READ', user.clientSiteId)

  const query = await getValidatedQuery(event, QuerySchema.parse)

  const to = query.to ?? new Date()
  const from = query.from ?? shiftMonths(to, -DEFAULT_RANGE_MONTHS)

  if (from >= to || from < shiftMonths(to, -MAX_RANGE_MONTHS))
    throw createError({ statusCode: 400, message: t('common.errors.invalidRequest')! })

  const earnings = await db.adEarning.findMany({
    where: {
      periodStart: { gte: from, lt: to },
      ...(query.clientSiteId ? { clientSiteId: query.clientSiteId } : {}),
    },
    select: {
      clientSiteId: true,
      periodStart: true,
      periodEnd: true,
      currency: true,
      plan: true,
      shareRatio: true,
      grossCents: true,
      clientCents: true,
      platformCents: true,
      payoutStatus: true,
      clientSite: { select: { name: true } },
    },
    orderBy: { periodStart: 'asc' },
  })

  const summaries = summarizeEarnings(earnings)

  const sites = new Map<
    string,
    {
      clientSiteId: string
      name: string
      currency: string
      grossCents: number
      clientCents: number
      platformCents: number
    }
  >()

  for (const row of earnings) {
    const key = `${row.clientSiteId}:${row.currency}`
    const site = sites.get(key) ?? {
      clientSiteId: row.clientSiteId,
      name: row.clientSite.name,
      currency: row.currency,
      grossCents: 0,
      clientCents: 0,
      platformCents: 0,
    }
    site.grossCents += row.grossCents
    site.clientCents += row.clientCents
    site.platformCents += row.platformCents
    sites.set(key, site)
  }

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    scope: user.role === 'superadmin' && !query.clientSiteId ? 'platform' : 'site',
    summaries,
    bySite: [...sites.values()].sort((a, b) => b.grossCents - a.grossCents),
  }
})
