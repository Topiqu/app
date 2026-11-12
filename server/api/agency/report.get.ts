import { z } from 'zod'

// A cell that starts with a formula character would run in a spreadsheet; quoting alone does not stop it.
const cell = (value: string | number | null) => {
  const text = value === null ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

const day = (date: Date | null | undefined) => date?.toISOString().slice(0, 10) ?? null

/** Per-blog usage for one billing period (the current one by default), for the agency's own client invoicing. */
export default defineEventHandler(async (event) => {
  const { member } = await requireAgencyMember(event)
  const { period: requested } = await getValidatedQuery(event, z.object({ period: z.iso.datetime().optional() }).parse)
  let chosen
  if (requested) {
    chosen = (await agencyPeriods(member.accountId)).find(
      (period) => period.start.getTime() === new Date(requested).getTime(),
    )
    if (!chosen) throw createError({ statusCode: 404, message: 'No such period' })
  }
  const { period, since, blogs, former } = await agencyBlogUsage(member.accountId, chosen)
  const start = day(since)
  const end = day(period?.end)
  const rows = [
    [
      'blog',
      'domain',
      'in_agency',
      'plan',
      'units_used',
      'unit_limit',
      'articles_published',
      'period_start',
      'period_end',
    ],
    ...blogs.map((blog) => [
      blog.name,
      blog.domain,
      'yes',
      blog.plan,
      blog.unitsUsed,
      blog.monthlyUnitLimit,
      blog.published,
      start,
      end,
    ]),
    ...former.map((blog) => [blog.name, blog.domain, 'no', null, blog.unitsUsed, null, null, start, end]),
  ]
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="agency-usage-${start}.csv"`)
  setHeader(event, 'Cache-Control', 'no-store')
  return rows.map((row) => row.map(cell).join(',')).join('\n')
})
