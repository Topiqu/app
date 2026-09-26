import { deleteFromCdn } from '~~/server/utils/storage'

export default defineTask({
  meta: { name: 'media-gc', description: 'Purges unreferenced tenant media after the recovery window' },
  async run() {
    const candidates = await prisma.mediaAsset.findMany({
      where: { purgeAfter: { lte: new Date() }, purgedAt: null },
      orderBy: { purgeAfter: 'asc' },
      take: 100,
    })
    let purged = 0
    let retained = 0
    for (const asset of candidates) {
      const references = await findMediaReferences(asset.clientSiteId, asset)
      if (references) {
        await prisma.mediaAsset.update({ where: { id: asset.id }, data: { purgeAfter: null } })
        retained++
        continue
      }
      const keys = [
        ...new Set([asset.storageKey, storageKeyFromMediaUrl(asset.deliveryUrl || '')].filter(Boolean)),
      ] as string[]
      try {
        for (const key of keys) {
          const prefix = key.startsWith('uploads/')
            ? 'uploads/'
            : key.startsWith('article-images/')
              ? 'article-images/'
              : key.startsWith('optimized/')
                ? 'optimized/'
                : ''
          if (prefix) await deleteFromCdn(key, prefix)
        }
      } catch (error) {
        await reportCaughtError('Media library purge failed', error, { mediaId: asset.id, keys })
        continue
      }
      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { purgedAt: new Date(), deletedAt: new Date() },
      })
      purged++
    }
    return { result: { scanned: candidates.length, purged, retained } }
  },
})
