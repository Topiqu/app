export default defineMonitoredTask({
  meta: { name: 'media-gc', description: 'Reviews due media deletion requests without unsafe physical deletion' },
  async run() {
    const now = new Date()
    const candidates = await prisma.mediaAsset.findMany({
      where: { archivedAt: { not: null }, purgeAfter: { lte: now }, purgedAt: null },
      orderBy: [{ updatedAt: { sort: 'asc', nulls: 'first' } }, { purgeAfter: 'asc' }, { id: 'asc' }],
      take: 100,
      select: {
        id: true,
        clientSiteId: true,
        url: true,
        deliveryUrl: true,
        storageKey: true,
        purgeAfter: true,
        updatedAt: true,
      },
    })
    let retained = 0
    let quarantined = 0
    let failed = 0
    let skipped = 0
    for (const asset of candidates) {
      const request = {
        id: asset.id,
        archivedAt: { not: null },
        purgeAfter: asset.purgeAfter,
        purgedAt: null,
        updatedAt: asset.updatedAt,
      }
      // Advance the bounded review queue even for retained/failed objects; otherwise its oldest
      // hundred requests would permanently starve every later one. The original request date stays.
      const reviewedAt = new Date(Math.max(now.getTime(), (asset.updatedAt?.getTime() ?? 0) + 1))
      const markReviewed = () => prisma.mediaAsset.updateMany({ where: request, data: { updatedAt: reviewedAt } })
      try {
        const references = await findMediaReferences(null, asset)
        if (references) {
          const changed = await prisma.mediaAsset.updateMany({
            where: request,
            data: { purgeAfter: null },
          })
          if (changed.count) retained++
          else skipped++
          continue
        }
        // HTML writers currently persist before best-effort usage indexing. A check/lease cannot
        // fence a new reference during remote deletion, so retain bytes until that contract exists.
        if ((await markReviewed()).count) quarantined++
        else skipped++
      } catch (error) {
        failed++
        await reportCaughtError('Media deletion review failed', error, { mediaId: asset.id })
        try {
          await markReviewed()
        } catch (progressError) {
          await reportCaughtError('Media deletion review progress failed', progressError, { mediaId: asset.id })
        }
      }
    }
    return {
      result: {
        scanned: candidates.length,
        processed: retained,
        purged: 0,
        retained,
        quarantined,
        failed,
        skipped: skipped + quarantined,
      },
    }
  },
})
