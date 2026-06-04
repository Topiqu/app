import type { Language, TranslationMode } from '@prisma/client'

const ALL_LANGUAGES: Language[] = ['cs', 'en']

type QueueDb = {
  clientSite: {
    findUnique: (args: any) => Promise<{
      language: Language
      translationMode: TranslationMode
      translationLanguages: Language[]
    } | null>
  }
  articleTranslation: {
    findMany: (args: any) => Promise<{ language: Language }[]>
    createMany: (args: any) => Promise<unknown>
    updateMany: (args: any) => Promise<unknown>
  }
}

/**
 * Keeps an article's translation queue in sync with its source for AUTO/HYBRID tenants.
 * Enqueues a PENDING row for every target language that has none yet; when the source
 * content changed, flips existing READY/PUBLISHED translations to STALE so the cron
 * re-translates them. No-op for OFF/MANUAL tenants — those translate on explicit request.
 *
 * STALE is driven by an explicit content-change signal (not `Article.updatedAt`, which the
 * view counter also bumps) to avoid re-charging tokens on every page view.
 */
export const syncArticleTranslationQueue = async (
  db: QueueDb,
  articleId: string,
  clientSiteId: string,
  opts: { contentChanged?: boolean } = {},
): Promise<void> => {
  const clientSite = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: { language: true, translationMode: true, translationLanguages: true },
  })
  if (!clientSite) return
  if (clientSite.translationMode !== 'AUTO' && clientSite.translationMode !== 'HYBRID') return

  const configured = clientSite.translationLanguages.length ? clientSite.translationLanguages : ALL_LANGUAGES
  const targets = configured.filter((language) => language !== clientSite.language)
  if (!targets.length) return

  const existing = await db.articleTranslation.findMany({ where: { articleId }, select: { language: true } })
  const existingLangs = new Set(existing.map((row) => row.language))
  const missing = targets.filter((language) => !existingLangs.has(language))

  if (missing.length) {
    await db.articleTranslation.createMany({
      data: missing.map((language) => ({ articleId, clientSiteId, language, status: 'PENDING' as const, source: 'AI' as const })),
      skipDuplicates: true,
    })
  }

  if (opts.contentChanged) {
    await db.articleTranslation.updateMany({
      where: { articleId, language: { in: targets }, status: { in: ['READY', 'PUBLISHED'] } },
      data: { status: 'STALE' },
    })
  }
}
