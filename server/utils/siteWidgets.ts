type WidgetDb = Awaited<ReturnType<typeof getEnhancedPrisma>>

export const listSiteWidgets = (db: WidgetDb, clientSiteId: string) =>
  db.siteWidget.findMany({
    where: { clientSiteId, deletedAt: null },
    select: { id: true, kind: true, slot: true, active: true, languages: true, config: true },
    orderBy: { position: 'asc' },
  })
