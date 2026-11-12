// A cell that starts with a formula character would run in a spreadsheet; quoting alone does not stop it.
const cell = (value: string | number | null) => {
  const text = value === null ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

/** Per-blog usage for the current period, for the agency's own client invoicing. */
export default defineEventHandler(async (event) => {
  const { member } = await requireAgencyMember(event)
  const { since, blogs } = await agencyBlogUsage(member.accountId)
  const rows = [
    ['blog', 'domain', 'plan', 'units_used', 'unit_limit', 'articles_published', 'period_start'],
    ...blogs.map((blog) => [
      blog.name,
      blog.domain,
      blog.plan,
      blog.unitsUsed,
      blog.monthlyUnitLimit,
      blog.published,
      since.toISOString().slice(0, 10),
    ]),
  ]
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="agency-usage-${since.toISOString().slice(0, 10)}.csv"`)
  setHeader(event, 'Cache-Control', 'no-store')
  return rows.map((row) => row.map(cell).join(',')).join('\n')
})
