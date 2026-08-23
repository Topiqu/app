import type { Language, TranslationMode } from '@prisma/client'

const ALL_LANGUAGES: Language[] = ['cs', 'en']

export const resolveTargetLanguages = (clientSite: {
  language: Language
  translationLanguages: Language[]
}): Language[] => {
  const configured = clientSite.translationLanguages.length ? clientSite.translationLanguages : ALL_LANGUAGES
  return configured.filter((language) => language !== clientSite.language)
}

type QueueDb = {
  clientSite: {
    findUnique: (args: any) => Promise<{
      language: Language
      translationMode: TranslationMode
      translationLanguages: Language[]
      // Optional so a concrete Prisma client (whose row type has no `features`) still fits
      // the structural contract; the select always asks for it, and a missing value fails closed.
      features?: { id: string }[]
    } | null>
  }
  articleTranslation: {
    findMany: (args: any) => Promise<{ language: Language }[]>
    createMany: (args: any) => Promise<unknown>
    updateMany: (args: any) => Promise<unknown>
  }
}

/**
 * The AI-feature check is not redundant with `translate-pending`: that task refuses to drain
 * the queue anyway, so enqueuing regardless would pile up invisible PENDING rows on every
 * publish — which a later re-subscribe drains as one burst of months-old translations.
 *
 * `contentChanged` is an explicit signal rather than `Article.updatedAt`, which the view
 * counter also bumps — that would re-charge translation tokens on every page view.
 */
export const syncArticleTranslationQueue = async (
  db: QueueDb,
  articleId: string,
  clientSiteId: string,
  opts: { contentChanged?: boolean } = {},
): Promise<void> => {
  const clientSite = await db.clientSite.findUnique({
    where: { id: clientSiteId },
    select: {
      language: true,
      translationMode: true,
      translationLanguages: true,
      features: { where: { isActive: true, feature: { code: 'AI' } }, select: { id: true }, take: 1 },
    },
  })
  if (!clientSite) return
  if (!clientSite.features?.length) return
  if (clientSite.translationMode !== 'AUTO' && clientSite.translationMode !== 'HYBRID') return

  const targets = resolveTargetLanguages(clientSite)
  if (!targets.length) return

  const existing = await db.articleTranslation.findMany({ where: { articleId }, select: { language: true } })
  const existingLangs = new Set(existing.map((row) => row.language))
  const missing = targets.filter((language) => !existingLangs.has(language))

  if (missing.length) {
    await db.articleTranslation.createMany({
      data: missing.map((language) => ({
        articleId,
        clientSiteId,
        language,
        status: 'PENDING' as const,
        source: 'AI' as const,
      })),
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
