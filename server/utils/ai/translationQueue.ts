import type { Language } from '~~/generated/zenstack/models'

import { activeTranslationLanguages } from '~~/shared/utils/translationLanguages'

/**
 * Only the languages the plan pays for. An empty selection means no translations — it used to mean
 * every language, which ten content languages would turn into nine free translations per article.
 * The site's own language is always a target for an article written in another one.
 */
export const resolveTargetLanguages = (
  clientSite: Parameters<typeof activeTranslationLanguages>[0],
  sourceLanguage: Language = clientSite.language,
): Language[] =>
  [...new Set([...activeTranslationLanguages(clientSite), clientSite.language])].filter(
    (language) => language !== sourceLanguage,
  )

type QueueDb = {
  article?: Pick<DatabaseTransaction['article'], 'findUnique'>
  clientSite: Pick<DatabaseTransaction['clientSite'], 'findUnique'>
  articleTranslation: Pick<DatabaseTransaction['articleTranslation'], 'findMany' | 'createMany' | 'updateMany'>
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
      plan: true,
      extraTranslationLanguages: true,
      translationMode: true,
      translationLanguages: true,
      features: { where: { isActive: true, feature: { code: 'AI' } }, select: { id: true }, take: 1 },
    },
  })
  if (!clientSite) return
  if (!clientSite.features?.length) return
  if (clientSite.translationMode !== 'AUTO' && clientSite.translationMode !== 'HYBRID') return

  const article = await db.article?.findUnique({ where: { id: articleId }, select: { language: true } })
  const targets = resolveTargetLanguages(clientSite, article?.language ?? clientSite.language)
  if (!targets.length) return

  const existing = await db.articleTranslation.findMany({
    where: { articleId, clientSiteId },
    select: { id: true, language: true, status: true, updatedAt: true },
  })
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
    for (const row of existing) {
      if (!targets.includes(row.language) || !['READY', 'PUBLISHED', 'TRANSLATING'].includes(row.status)) continue
      await db.articleTranslation.updateMany({
        where: { id: row.id, articleId, clientSiteId, status: row.status, updatedAt: row.updatedAt },
        data: { status: 'STALE', translationStartedAt: null, updatedAt: nextTranslationVersion(row.updatedAt) },
      })
    }
  }
}
