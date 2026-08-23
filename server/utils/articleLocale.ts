import type { Language } from '@prisma/client'

import { overlayTranslations, type LocalizableArticle } from '~~/shared/utils/articleLocale'

type LocalizeDb = {
  articleTranslation: {
    findMany: (
      args: any,
    ) => Promise<{ articleId: string; slug: string | null; title: string | null; excerpt: string | null }[]>
  }
}

/**
 * Swaps listing cards over to their PUBLISHED translation for a non-primary locale. Status is
 * filtered explicitly rather than left to the ZenStack policy, whose read rule also passes for
 * an admin on their own site — otherwise a logged-in admin would see unreviewed drafts in the
 * public feed.
 */
export const localizeArticles = async <T extends LocalizableArticle>(
  db: LocalizeDb,
  articles: T[],
  opts: { clientSiteId: string; locale?: Language | string; primaryLanguage: Language | string },
): Promise<T[]> => {
  const { clientSiteId, locale, primaryLanguage } = opts
  if (!locale || locale === primaryLanguage || !articles.length) return articles

  const overlays = await db.articleTranslation.findMany({
    where: {
      articleId: { in: articles.map((article) => article.id) },
      clientSiteId,
      language: locale,
      status: 'PUBLISHED',
    },
    select: { articleId: true, slug: true, title: true, excerpt: true },
  })

  return overlayTranslations(articles, overlays)
}
