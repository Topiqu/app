export default defineEventHandler(async (event) => {
  const user = (await getServerSession(event))?.user
  if (!user) throw createError({ statusCode: 401, message: 'Neautorizováno' })
  if (!user.clientSiteId) throw createError({ statusCode: 403, message: 'Uživatel není přiřazen k žádnému ClientSite' })

  interface ViewResult {
    date: Date
    views: bigint
  }

  const views = await prisma.$queryRaw<ViewResult[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS date, SUM(views) AS views
    FROM "Article"
    WHERE "clientSiteId" = ${user.clientSiteId}
    AND "createdAt" >= ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date
  `

  return views.map((view) => ({
    date: view.date.toISOString().slice(5, 10),
    views: Number(view.views) || 0,
  }))
})
